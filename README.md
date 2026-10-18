# Darts Match Counter & Tournament Organizer

A fast, lightweight, dependency-free web-based darts match counter and tournament management app.
Works anywhere: locally, offline, and hosted directly via **GitHub Pages**.

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/bdbotond)

## Features
- **All-in-one Single File**: Entire application runs self-contained from [`index.html`](index.html).
- **Mobile Remote Scorer**: Connect your phone via Wi-Fi, Mobile Hotspot, or Bluetooth PAN (`index.html?screen=remote`). Features a touch-optimized numpad, 3-dart keypad, double tracking, undo, and QR code pairing.
- **Dual-Screen Scoreboard**: Open a second screen (`index.html?screen=display`) on a TV or second monitor. Synchronizes in real time with zero lag via Server-Sent Events and `BroadcastChannel`.
- **Match Scoring**:
  - Standard X01 games (501, 301, 701, custom).
  - Single or Double Out, First to N legs.
  - Live checkout recommendations (170 down to 2).
  - Two input modes: Fast numeric input (with common shortcuts like 180, 140, 100) and 3-Dart dartboard matrix keypad.
  - Double attempt & checkout percentage tracking.
  - Undo turn support.
- **Tournament Organizer**:
  - Groups + Knockout Tree (Round-robin groups, automated standings, top N advance to playoff bracket).
  - Direct Knockout Tree (Single-elimination bracket).
  - Mid-tournament live player statistics modal.
  - One-click CSV export of tournament statistics.


## Local Usage
1. **Direct Browser**: Simply double-click `index.html`. No server required for single-machine play.
2. **With Mobile Phone Remote**:
   Start the zero-dependency local network server:
   ```bash
   python3 server.py
   ```
   Open `http://localhost:8000` on your PC, click **📱 Connect Phone**, and scan the QR code with your phone camera.

### Mobile Connection Methods

| Method | Setup | Notes |
|---|---|---|
| **USB Tethering** *(Recommended)* | Connect phone via USB cable → Phone Settings → Connections → Enable **USB Tethering** | Fast, charges phone, 100% bypasses Wi-Fi AP isolation. |
| **PC Wi-Fi Hotspot** | Turn on Hotspot on your PC/Mac → Connect phone to computer's Wi-Fi | Computer acts as router gateway; phone browsers always allow gateway access. |
| **Shared Wi-Fi Network** | Connect both PC and phone to same home/office Wi-Fi router | Seamless if router does not have client isolation turned on. |
| **Phone Wi-Fi Hotspot** | Connect PC to phone's Wi-Fi hotspot | May require USB tethering or PC hotspot if phone enforces AP client isolation. |

#### Turning your Computer into a Wi-Fi Hotspot
- **Linux (GNOME / KDE)**: Open **Settings → Wi-Fi → Turn On Wi-Fi Hotspot...** (or via terminal: `nmcli dev wifi hotspot ssid Darts password darts1234`).
- **Windows 10 / 11**: Open **Settings → Network & internet → Mobile hotspot** → Toggle **ON** (Share my internet connection over Wi-Fi).
- **macOS**: Open **System Settings → General → Sharing → Internet Sharing** (Click info icon, set to share your connection to Wi-Fi).

---

### Mobile Troubleshooting ("Site cannot be reached" / Timeout)

If your mobile browser shows a timeout when loading the remote screen:

1. **AP Client Isolation on Phone Hotspots**:
   - When a phone hosts a Wi-Fi hotspot, Android and iOS often isolate the phone's internal browser from communicating with downstream connected Wi-Fi clients.
   - **Fix**: Switch to **USB Tethering** (plug USB cable, turn on USB Tethering) or turn your **computer into the Wi-Fi hotspot** instead.
2. **Strict HTTP URL**:
   - Mobile browsers (Chrome/Safari) often auto-prefix `https://` if an IP is entered manually.
   - Ensure the URL begins explicitly with `http://` (e.g. `http://<ip>:8000/?screen=remote`).
3. **Computer Firewall Rules (Port 8000)**:
   Ensure your operating system allows incoming TCP traffic on port 8000:
   - **Linux - UFW (Ubuntu, Debian, Linux Mint)**:
     ```bash
     sudo ufw allow 8000/tcp
     ```
   - **Linux - firewalld (Fedora, RHEL, CentOS, Rocky Linux)**:
     ```bash
     sudo firewall-cmd --add-port=8000/tcp --permanent
     sudo firewall-cmd --reload
     ```
   - **Linux - iptables / nftables (Arch Linux, generic)**:
     ```bash
     # iptables
     sudo iptables -I INPUT -p tcp --dport 8000 -j ACCEPT

     # nftables
     sudo nft add rule inet filter input tcp dport 8000 accept
     ```
   - **Windows (PowerShell as Administrator)**:
     ```powershell
     New-NetFirewallRule -DisplayName "Darts Counter Server" -Direction Inbound -LocalPort 8000 -Protocol TCP -Action Allow
     ```
     *(Or via GUI: Windows Security → Firewall & network protection → Allow python.exe on Private networks).*
   - **macOS Application Firewall**:
     - When prompted by macOS upon starting `server.py`, click **"Allow"** for incoming connections.
     - Or configure manually: **System Settings → Network → Firewall → Options → Add Python / python3 → Allow incoming connections**.
4. **PC Browser URL**:
   - Always open `http://localhost:8000` on your PC rather than `file:///` so the browser communicates directly with the local server.


