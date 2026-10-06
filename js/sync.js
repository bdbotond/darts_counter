    // --- 4. REALTIME SYNC (BroadcastChannel) ---
    const SYNC_CHANNEL = "darts_scoreboard_channel";

    class SyncHub {
      constructor(isHost) {
        this.isHost = isHost;
        this.listeners = [];
        this.latest = null;
        this.bc = new BroadcastChannel(SYNC_CHANNEL);
        this.bc.onmessage = (e) => this.receive(e.data);
      }

      receive(msg) {
        if (!msg) return;
        if (this.isHost && msg.type === "REQUEST_STATE" && this.latest) {
          this.broadcast(this.latest);
        } else if (msg.type === "GAME_STATE") {
          this.listeners.forEach(fn => fn(msg.payload));
        }
      }

      broadcast(state) {
        this.latest = state;
        try { this.bc.postMessage({ type: "GAME_STATE", payload: state }); } catch (e) {}
      }

      request() {
        try { this.bc.postMessage({ type: "REQUEST_STATE" }); } catch (e) {}
      }

      onState(fn) {
        this.listeners.push(fn);
      }
    }

