// Real-time synchronization using BroadcastChannel with localStorage fallback
const CHANNEL_NAME = "darts_scoreboard_channel";
const STORAGE_KEY = "darts_scoreboard_state";

export class SyncManager {
  constructor(isHost = false) {
    this.isHost = isHost;
    this.listeners = [];
    this.channel = null;

    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (event) => this.handleMessage(event.data);
      } catch (e) {
        console.warn("BroadcastChannel error, falling back to localStorage", e);
      }
    }

    if (typeof window !== "undefined") {
      window.addEventListener("storage", (event) => {
        if (event.key === STORAGE_KEY && event.newValue) {
          try {
            const data = JSON.parse(event.newValue);
            this.handleMessage(data);
          } catch (e) {
            console.error("Storage sync parse error", e);
          }
        }
      });
    }
  }

  handleMessage(data) {
    if (!data) return;
    if (this.isHost && data.type === "REQUEST_STATE") {
      if (this.currentState) {
        this.broadcast(this.currentState);
      }
    } else if (data.type === "GAME_STATE") {
      this.listeners.forEach((cb) => cb(data.payload));
    }
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  broadcast(gameState) {
    this.currentState = gameState;
    const msg = { type: "GAME_STATE", payload: gameState, timestamp: Date.now() };

    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch (e) {
        console.warn("BroadcastChannel post error", e);
      }
    }

    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(msg));
      } catch (e) {}
    }
  }

  requestState() {
    const msg = { type: "REQUEST_STATE", timestamp: Date.now() };
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch (e) {}
    }
    // Also try checking localStorage directly
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.payload) {
            this.listeners.forEach((cb) => cb(parsed.payload));
          }
        } catch (e) {}
      }
    }
  }
}
