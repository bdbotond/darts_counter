#!/usr/bin/env python3
"""
Zero-dependency local HTTP + Server-Sent Events (SSE) server for Darts Counter.
Allows smartphones and secondary screens to connect over Wi-Fi, Hotspot, or Bluetooth PAN.

Usage:
    python3 server.py [port]
"""

import sys
import os
import json
import time
import socket
import queue
import threading
from urllib.parse import urlparse, parse_qs, unquote
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

# Thread-safe event hub for SSE clients
class EventHub:
    def __init__(self):
        self.lock = threading.Lock()
        self.listeners = set()
        self.latest_state = None

    def add_listener(self, q):
        with self.lock:
            self.listeners.add(q)
            # Push latest state immediately on connect
            if self.latest_state:
                q.put({"type": "GAME_STATE", "payload": self.latest_state})

    def remove_listener(self, q):
        with self.lock:
            self.listeners.discard(q)

    def broadcast(self, message):
        with self.lock:
            if message.get("type") == "GAME_STATE":
                self.latest_state = message.get("payload")
            dead = []
            for q in list(self.listeners):
                try:
                    if q.full():
                        try:
                            q.get_nowait()
                        except queue.Empty:
                            pass
                    q.put_nowait(message)
                except Exception:
                    dead.append(q)
            for q in dead:
                self.listeners.discard(q)

hub = EventHub()

def get_local_ip_addresses():
    """Detect active local IPv4 addresses, prioritizing Wi-Fi/Hotspot over Ethernet and virtual bridges."""
    wifi_ips = []
    eth_ips = []
    other_ips = []

    # Method 1 (Linux): parse ip -4 -br addr show to identify interface types and operational state
    try:
        import subprocess
        out = subprocess.check_output(["ip", "-4", "-br", "addr", "show"], stderr=subprocess.DEVNULL).decode()
        for line in out.splitlines():
            parts = line.strip().split()
            if len(parts) < 3:
                continue
            ifname, state, addrs = parts[0], parts[1], parts[2:]
            if ifname == "lo" or state.upper() == "DOWN":
                continue
            if any(ifname.startswith(p) for p in ("docker", "br-", "veth", "virbr", "tun", "tap", "dummy")):
                continue
            for a in addrs:
                ip = a.split("/")[0]
                if ip.startswith("127."):
                    continue
                if any(ifname.startswith(w) for w in ("wl", "wifi", "wlan", "hotspot")):
                    wifi_ips.append(ip)
                elif any(ifname.startswith(e) for e in ("en", "eth")):
                    eth_ips.append(ip)
                else:
                    other_ips.append(ip)
    except Exception:
        pass

    # Method 2: Fallback (macOS / Windows / restricted Linux)
    if not wifi_ips and not eth_ips and not other_ips:
        seen = set()
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            if not ip.startswith("127."):
                seen.add(ip)
            s.close()
        except Exception:
            pass

        try:
            hostname = socket.gethostname()
            for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
                ip = info[4][0]
                if not ip.startswith("127.") and not any(ip.startswith(f"172.{b}.") for b in range(16, 32)):
                    seen.add(ip)
        except Exception:
            pass

        for ip in seen:
            other_ips.append(ip)

    res = []
    for ip in wifi_ips + eth_ips + other_ips:
        if ip not in res:
            res.append(ip)
    if not res:
        res.append("127.0.0.1")
    return res

# Compact pure-python QR code generator (Version 1-6 Byte mode, Error Correction Level L)
# Generates valid SVG without external libraries
class MiniQR:
    # GF(256) math with primitive poly 0x11d (285)
    EXP = [0] * 512
    LOG = [0] * 256
    initialized = False

    @classmethod
    def init_gf(cls):
        if cls.initialized:
            return
        x = 1
        for i in range(255):
            cls.EXP[i] = x
            cls.LOG[x] = i
            x <<= 1
            if x & 0x100:
                x ^= 0x11d
        for i in range(255, 512):
            cls.EXP[i] = cls.EXP[i - 255]
        cls.initialized = True

    @classmethod
    def poly_mul(cls, p1, p2):
        res = [0] * (len(p1) + len(p2) - 1)
        for i, c1 in enumerate(p1):
            if c1 == 0:
                continue
            for j, c2 in enumerate(p2):
                if c2 == 0:
                    continue
                res[i + j] ^= cls.EXP[cls.LOG[c1] + cls.LOG[c2]]
        return res

    @classmethod
    def poly_mod(cls, dividend, divisor):
        res = list(dividend)
        for i in range(len(dividend) - len(divisor) + 1):
            coef = res[i]
            if coef != 0:
                for j in range(1, len(divisor)):
                    if divisor[j] != 0:
                        res[i + j] ^= cls.EXP[cls.LOG[divisor[j]] + cls.LOG[coef]]
        return res[len(dividend) - len(divisor) + 1:]

    @classmethod
    def rs_generator(cls, num_ec):
        g = [1]
        for i in range(num_ec):
            g = cls.poly_mul(g, [1, cls.EXP[i]])
        return g

    # Capacity table for Byte mode, EC level L
    # (version, total_codewords, ec_codewords, data_capacity_bytes)
    VERSIONS = [
        (1, 26, 7, 17),
        (2, 44, 10, 32),
        (3, 70, 15, 53),
        (4, 100, 20, 78),
        (5, 134, 26, 106),
        (6, 172, 36, 134),
    ]

    ALIGN_PATTERNS = {
        2: [6, 18],
        3: [6, 22],
        4: [6, 26],
        5: [6, 30],
        6: [6, 34],
    }

    @classmethod
    def encode(cls, text):
        cls.init_gf()
        data = text.encode("utf-8")
        ver_info = None
        for v, total_cw, ec_cw, cap in cls.VERSIONS:
            if len(data) <= cap:
                ver_info = (v, total_cw, ec_cw, cap)
                break
        if not ver_info:
            ver_info = cls.VERSIONS[-1]
            data = data[:ver_info[3]]

        version, total_cw, ec_cw, data_cw_count = ver_info
        size = 17 + version * 4

        # Mode indicator for byte: 0100 (4 bits)
        # Character count: 8 bits for ver 1-9
        bits = "0100" + f"{len(data):08b}"
        for b in data:
            bits += f"{b:08b}"
        # Terminator
        needed_bits = data_cw_count * 8
        bits += "0000"
        if len(bits) > needed_bits:
            bits = bits[:needed_bits]
        # Pad to multiple of 8
        if len(bits) % 8 != 0:
            bits += "0" * (8 - (len(bits) % 8))
        # Pad bytes 236 and 17
        pad_bytes = ["11101100", "00010001"]
        pad_idx = 0
        while len(bits) < needed_bits:
            bits += pad_bytes[pad_idx % 2]
            pad_idx += 1

        data_bytes = [int(bits[i:i+8], 2) for i in range(0, len(bits), 8)]
        gen_poly = cls.rs_generator(ec_cw)
        to_encode = data_bytes + [0] * ec_cw
        ec_bytes = cls.poly_mod(to_encode, gen_poly)
        all_codewords = data_bytes + ec_bytes

        # Convert to bitstream
        final_bits = "".join(f"{b:08b}" for b in all_codewords)

        # Build matrix
        matrix = [[None] * size for _ in range(size)]
        reserved = [[False] * size for _ in range(size)]

        def set_func(r, c, val):
            matrix[r][c] = val
            reserved[r][c] = True

        # Finder patterns
        def add_finder(start_r, start_c):
            for r in range(7):
                for c in range(7):
                    is_black = (r in (0, 6) or c in (0, 6) or (2 <= r <= 4 and 2 <= c <= 4))
                    set_func(start_r + r, start_c + c, 1 if is_black else 0)
            # Separator
            for r in range(-1, 8):
                for c in range(-1, 8):
                    rr, cc = start_r + r, start_c + c
                    if 0 <= rr < size and 0 <= cc < size and not reserved[rr][cc]:
                        set_func(rr, cc, 0)

        add_finder(0, 0)
        add_finder(0, size - 7)
        add_finder(size - 7, 0)

        # Timing patterns
        for i in range(8, size - 8):
            if not reserved[6][i]:
                set_func(6, i, 1 if i % 2 == 0 else 0)
            if not reserved[i][6]:
                set_func(i, 6, 1 if i % 2 == 0 else 0)

        # Alignment patterns
        if version in cls.ALIGN_PATTERNS:
            coords = cls.ALIGN_PATTERNS[version]
            for ar in coords:
                for ac in coords:
                    if (ar < 9 and ac < 9) or (ar < 9 and ac >= size - 9) or (ar >= size - 9 and ac < 9):
                        continue
                    for dr in range(-2, 3):
                        for dc in range(-2, 3):
                            is_b = (max(abs(dr), abs(dc)) in (0, 2))
                            set_func(ar + dr, ac + dc, 1 if is_b else 0)

        # Dark module
        set_func(4 * version + 9, 8, 1)

        # Reserve format info areas
        for c in range(9):
            if not reserved[8][c]:
                reserved[8][c] = True
        for r in range(9):
            if not reserved[r][8]:
                reserved[r][8] = True
        for c in range(size - 8, size):
            reserved[8][c] = True
        for r in range(size - 7, size):
            reserved[r][8] = True

        # Place data bits (Mask 0: (row + col) % 2 == 0)
        bit_idx = 0
        right = size - 1
        upward = True
        while right > 0:
            if right == 6:
                right -= 1
            rows = range(size - 1, -1, -1) if upward else range(size)
            for r in rows:
                for c in (right, right - 1):
                    if not reserved[r][c]:
                        bit_val = int(final_bits[bit_idx]) if bit_idx < len(final_bits) else 0
                        bit_idx += 1
                        # Apply mask pattern 0: (r + c) % 2 == 0
                        if (r + c) % 2 == 0:
                            bit_val ^= 1
                        matrix[r][c] = bit_val
            right -= 2
            upward = not upward

        # Format info: EC Level L (01) + Mask 0 (000) = 01000 = 8
        # Format string for L0: 111011111000100 (15 bits with BCH)
        fmt = "111011111000100"
        fmt_coords_1 = [
            (8, 0), (8, 1), (8, 2), (8, 3), (8, 4), (8, 5), (8, 7), (8, 8),
            (7, 8), (5, 8), (4, 8), (3, 8), (2, 8), (1, 8), (0, 8)
        ]
        fmt_coords_2 = [
            (size - 1, 8), (size - 2, 8), (size - 3, 8), (size - 4, 8),
            (size - 5, 8), (size - 6, 8), (size - 7, 8), (8, size - 8),
            (8, size - 7), (8, size - 6), (8, size - 5), (8, size - 4),
            (8, size - 3), (8, size - 2), (8, size - 1)
        ]
        for idx in range(15):
            val = int(fmt[idx])
            r1, c1 = fmt_coords_1[idx]
            r2, c2 = fmt_coords_2[idx]
            matrix[r1][c1] = val
            matrix[r2][c2] = val

        return matrix

    @classmethod
    def to_svg(cls, text, module_size=6, margin=4):
        matrix = cls.encode(text)
        size = len(matrix)
        total_dim = (size + margin * 2) * module_size
        rects = []
        for r in range(size):
            for c in range(size):
                if matrix[r][c] == 1:
                    x = (c + margin) * module_size
                    y = (r + margin) * module_size
                    rects.append(f'<rect x="{x}" y="{y}" width="{module_size}" height="{module_size}" fill="#000000"/>')
        body = "".join(rects)
        return (
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total_dim} {total_dim}" '
            f'width="{total_dim}" height="{total_dim}" shape-rendering="crispEdges">'
            f'<rect width="100%" height="100%" fill="#ffffff"/>'
            f'{body}</svg>'
        )

    @classmethod
    def to_ascii(cls, text, margin=2):
        matrix = cls.encode(text)
        size = len(matrix)
        padded = [[0] * (size + margin * 2) for _ in range(margin)]
        for row in matrix:
            padded.append([0] * margin + row + [0] * margin)
        padded += [[0] * (size + margin * 2) for _ in range(margin)]

        lines = []
        for r in range(0, len(padded), 2):
            top_row = padded[r]
            bot_row = padded[r + 1] if r + 1 < len(padded) else [0] * len(top_row)
            row_chars = []
            for c in range(len(top_row)):
                t, b = top_row[c], bot_row[c]
                if t == 1 and b == 1:
                    row_chars.append(" ")
                elif t == 1 and b == 0:
                    row_chars.append("▄")
                elif t == 0 and b == 1:
                    row_chars.append("▀")
                else:
                    row_chars.append("█")
            lines.append("".join(row_chars))
        return "\n".join(lines)


class DartsHTTPRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        # Suppress noisy SSE poll logs; keep startup and errors visible
        try:
            msg = format % args if args else format
            if "/api/events" in msg or "/api/message" in msg:
                return
        except Exception:
            pass
        super().log_message(format, *args)

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, *")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return

        if parsed.path == "/api/info":
            ips = get_local_ip_addresses()
            info = {
                "port": PORT,
                "ips": ips,
                "urls": [f"http://{ip}:{PORT}/?screen=remote" for ip in ips]
            }
            body = json.dumps(info).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(body)
            return

        if parsed.path == "/api/qr":
            query = parse_qs(parsed.query)
            data_val = query.get("data", [""])[0]
            if not data_val:
                data_val = f"http://127.0.0.1:{PORT}/?screen=remote"
            svg_content = MiniQR.to_svg(data_val).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "image/svg+xml")
            self.send_header("Content-Length", str(len(svg_content)))
            self.send_header("Cache-Control", "no-cache")
            self.send_cors_headers()
            self.end_headers()
            self.wfile.write(svg_content)
            return

        if parsed.path == "/api/events":
            # Server-Sent Events stream
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_cors_headers()
            self.end_headers()

            client_queue = queue.Queue(maxsize=100)
            hub.add_listener(client_queue)

            # Send initial keepalive comment
            try:
                self.wfile.write(b": connected\n\n")
                self.wfile.flush()
            except Exception:
                hub.remove_listener(client_queue)
                return

            try:
                while True:
                    try:
                        msg = client_queue.get(timeout=15.0)
                        data_str = json.dumps(msg)
                        self.wfile.write(f"data: {data_str}\n\n".encode("utf-8"))
                        self.wfile.flush()
                    except queue.Empty:
                        # Keep-alive heartbeat
                        self.wfile.write(b": keepalive\n\n")
                        self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, Exception):
                pass
            finally:
                hub.remove_listener(client_queue)
            return

        # Serve static files
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/message":
            content_len = int(self.headers.get("Content-Length", 0))
            body_bytes = self.rfile.read(content_len)
            try:
                message = json.loads(body_bytes.decode("utf-8"))
                hub.broadcast(message)
                resp = json.dumps({"status": "ok"}).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(resp)))
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(resp)
            except Exception as e:
                err = json.dumps({"status": "error", "message": str(e)}).encode("utf-8")
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(err)))
                self.send_cors_headers()
                self.end_headers()
                self.wfile.write(err)
            return

        self.send_response(404)
        self.end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()


def run_server():
    server_address = ("0.0.0.0", PORT)
    ThreadingHTTPServer.allow_reuse_address = True
    try:
        httpd = ThreadingHTTPServer(server_address, DartsHTTPRequestHandler)
    except OSError as e:
        print(f"\n❌ Error starting server on port {PORT}: {e}")
        print(f"Try running on a different port: python3 server.py {PORT + 1}\n")
        sys.exit(1)

    ips = get_local_ip_addresses()
    primary_ip = ips[0]
    remote_url = f"http://{primary_ip}:{PORT}/?screen=remote"

    print("\n" + "=" * 60)
    print("🎯 Darts Counter Local Network Server Running")
    print("=" * 60)
    print(f"🖥️  Main Host UI:      http://localhost:{PORT}")
    print(f"📺  TV Spectator:       http://localhost:{PORT}/?screen=display")
    print("-" * 60)
    print("📱 Scan QR code with phone camera to connect directly:")
    try:
        print(MiniQR.to_ascii(remote_url))
    except Exception:
        pass
    print("-" * 60)
    print(f"📱 Primary Phone Link: {remote_url}")
    if len(ips) > 1:
        print("   Other available network interfaces:")
        for ip in ips[1:]:
            print(f"   • http://{ip}:{PORT}/?screen=remote")
    print("=" * 60 + "\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.server_close()

if __name__ == "__main__":
    run_server()
