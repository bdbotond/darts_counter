// Realtime Sync Hub with dual transport: BroadcastChannel (local tabs) + HTTP SSE / POST (network)
const SYNC_CHANNEL = "darts_scoreboard_channel";

class SyncHub {
  constructor(isHost) {
    this.isHost = Boolean(isHost);
    this.stateListeners = [];
    this.actionListeners = [];
    this.latest = null;
    this.seenMsgIds = new Set();
    this.eventSource = null;

    // 1. BroadcastChannel (fast local tab sync)
    try {
      this.bc = new BroadcastChannel(SYNC_CHANNEL);
      this.bc.onmessage = (e) => this.handleIncoming(e.data, "bc");
    } catch (e) {
      this.bc = null;
    }

    // 2. Server-Sent Events (cross-device over Wi-Fi / Hotspot / Bluetooth)
    this.serverBase = "";
    this.initNetworkTransport();
  }

  static async discoverServer(forceRefresh = false) {
    if (!forceRefresh && SyncHub._serverBase !== undefined) {
      return SyncHub._serverBase;
    }

    // 1. Try relative if served over http/https
    if (typeof window !== "undefined" && window.location && window.location.protocol.startsWith("http")) {
      try {
        const res = await fetch("/api/info", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          SyncHub._serverBase = "";
          SyncHub._serverInfo = data;
          return "";
        }
      } catch (e) {}
    }

    // 2. Fallback to localhost:8000 and 127.0.0.1:8000 (e.g. when opened via file:// or another port)
    for (const host of ["http://localhost:8000", "http://127.0.0.1:8000"]) {
      try {
        const res = await fetch(`${host}/api/info`, { cache: "no-store", mode: "cors" });
        if (res.ok) {
          const data = await res.json();
          SyncHub._serverBase = host;
          SyncHub._serverInfo = data;
          return host;
        }
      } catch (e) {}
    }

    SyncHub._serverBase = null;
    SyncHub._serverInfo = null;
    return null;
  }

  async initNetworkTransport() {
    this.serverAvailable = false;
    const base = await SyncHub.discoverServer();
    if (base === null) return;

    this.serverBase = base;
    this.serverAvailable = true;
    this.startEventSource();
  }

  startEventSource() {
    try {
      const url = (this.serverBase || "") + "/api/events";
      const es = new EventSource(url);
      es.onmessage = (e) => {
        if (!e.data) return;
        try {
          const msg = JSON.parse(e.data);
          this.handleIncoming(msg, "sse");
        } catch (err) {}
      };
      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) {
          this.serverAvailable = false;
        }
      };
      this.eventSource = es;
    } catch (e) {}
  }

  handleIncoming(msg, source) {
    if (!msg || typeof msg !== "object") return;

    // Deduplicate messages across dual transports
    if (msg.id) {
      if (this.seenMsgIds.has(msg.id)) return;
      this.seenMsgIds.add(msg.id);
      if (this.seenMsgIds.size > 200) {
        const oldest = this.seenMsgIds.values().next().value;
        this.seenMsgIds.delete(oldest);
      }
    }

    if (msg.type === "REQUEST_STATE") {
      if (this.isHost && this.latest) {
        this.broadcast(this.latest);
      }
    } else if (msg.type === "GAME_STATE") {
      this.latest = msg.payload;
      this.stateListeners.forEach(fn => {
        try { fn(msg.payload); } catch (e) {}
      });
    } else if (msg.type === "REMOTE_ACTION") {
      if (this.isHost) {
        this.actionListeners.forEach(fn => {
          try { fn(msg.payload); } catch (e) {}
        });
      }
    }
  }

  _postToNetwork(msg) {
    if (!this.serverAvailable) return;

    try {
      const url = (this.serverBase || "") + "/api/message";
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msg)
      }).catch(() => {});
    } catch (e) {}
  }

  broadcast(state) {
    this.latest = state;
    const msgId = `st_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    this.seenMsgIds.add(msgId);
    const msg = { id: msgId, type: "GAME_STATE", payload: state };

    if (this.bc) {
      try { this.bc.postMessage(msg); } catch (e) {}
    }
    this._postToNetwork(msg);
  }

  sendAction(action) {
    const msgId = `ac_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    this.seenMsgIds.add(msgId);
    const msg = { id: msgId, type: "REMOTE_ACTION", payload: action };

    if (this.bc) {
      try { this.bc.postMessage(msg); } catch (e) {}
    }
    this._postToNetwork(msg);
  }

  request() {
    const msgId = `rq_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const msg = { id: msgId, type: "REQUEST_STATE" };
    if (this.bc) {
      try { this.bc.postMessage(msg); } catch (e) {}
    }
    this._postToNetwork(msg);
  }

  onState(fn) {
    if (typeof fn === "function") this.stateListeners.push(fn);
  }

  onAction(fn) {
    if (typeof fn === "function") this.actionListeners.push(fn);
  }
}

window.SyncHub = SyncHub;
