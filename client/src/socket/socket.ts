import { WS_URL } from "@app/config";
import type { ClientMessage, ServerMessage } from "./events";

type MessageHandler = (msg: ServerMessage) => void;
type StatusHandler = (connected: boolean) => void;

class SocketClient {
  #ws: WebSocket | null = null;
  #messageHandler: MessageHandler | null = null;
  #statusHandler: StatusHandler | null = null;
  #params: { name: string; colour: string; uuid: string } | null = null;
  #intentional = false;
  #retry = 0;
  #retryTimer: ReturnType<typeof setTimeout> | null = null;

  /** Register the handler that routes incoming messages into the store. */
  onMessage(fn: MessageHandler) {
    this.#messageHandler = fn;
  }

  /** Optional: observe connected/disconnected (for a status dot later). */
  onStatus(fn: StatusHandler) {
    this.#statusHandler = fn;
  }

  /** Open the socket. The session cookie rides the handshake automatically. */
  connect(p: { name: string; colour: string; uuid: string }) {
    this.#params = p;
    this.#retry = 0;
    this.#intentional = false;
    this.#open();
  }

  /** Keep reconnect params current so a reconnect doesn't revert a rename. */
  updateParams(p: Partial<{ name: string; colour: string }>) {
    if (this.#params) this.#params = { ...this.#params, ...p };
  }

  /** Send a typed message. Dropped silently if the socket isn't open. */
  send(msg: ClientMessage) {
    if (this.#ws?.readyState === WebSocket.OPEN) {
      this.#ws.send(JSON.stringify(msg));
    }
  }

  /** Intentional close (logout) — suppresses reconnect. */
  disconnect() {
    this.#intentional = true;
    if (this.#retryTimer) clearTimeout(this.#retryTimer);
    this.#retryTimer = null;
    this.#ws?.close();
    this.#ws = null;
  }

  // arrow field so setTimeout(this.#open, …) keeps `this`
  #open = () => {
    this.#retryTimer = null;
    if (!this.#params || this.#intentional) return;

    const existing = this.#ws;
    if (
      existing &&
      (existing.readyState === WebSocket.OPEN ||
        existing.readyState === WebSocket.CONNECTING)
    ) {
      return; // already up or coming up
    }

    const { name, colour, uuid } = this.#params;
    const qs = new URLSearchParams({ name, colour, uuid });
    const ws = new WebSocket(`${WS_URL}?${qs.toString()}`);
    this.#ws = ws;

    // Every handler ignores a socket that's no longer current — e.g. one closed
    // by disconnect() under StrictMode's mount/unmount/mount — so a stale close
    // can't clobber the live socket or schedule a duplicate reconnect.
    ws.onopen = () => {
      if (this.#ws !== ws) return;
      this.#retry = 0;
      this.#statusHandler?.(true);
    };

    ws.onmessage = (e) => {
      if (this.#ws !== ws) return;
      try {
        this.#messageHandler?.(JSON.parse(e.data) as ServerMessage);
      } catch {
        // ignore malformed frames (server is ours; this shouldn't happen)
      }
    };

    ws.onclose = () => {
      if (this.#ws !== ws) return;
      this.#ws = null;
      this.#statusHandler?.(false);
      if (!this.#intentional) {
        const delay = Math.min(1000 * 2 ** this.#retry, 10000); // backoff, capped 10s
        this.#retry += 1;
        this.#retryTimer = setTimeout(this.#open, delay);
      }
    };

    ws.onerror = () => {
      ws.close(); // let onclose handle the reconnect
    };
  };
}

// One shared instance. It's a module export, not a global, so nothing on the
// console can reach it — and #ws is hard-private even if someone got the instance.
export const socket = new SocketClient();
