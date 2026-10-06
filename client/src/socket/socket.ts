import { WS_URL } from "@app/config";
import type { ClientMessage, ServerMessage } from "./events";

type MessageHandler = (msg: ServerMessage) => void;
type StatusHandler = (connected: boolean) => void;

class SocketClient {
  #ws: WebSocket | null = null;
  #messageHandler: MessageHandler | null = null;
  #statusHandler: StatusHandler | null = null;
  #params: { name: string; colour: string } | null = null;
  #intentional = false;
  #retry = 0;

  /** Register the handler that routes incoming messages into the store. */
  onMessage(fn: MessageHandler) {
    this.#messageHandler = fn;
  }

  /** Optional: observe connected/disconnected (for a status dot later). */
  onStatus(fn: StatusHandler) {
    this.#statusHandler = fn;
  }

  /** Open the socket. The session cookie rides the handshake automatically. */
  connect(p: { name: string; colour: string }) {
    this.#params = p;
    this.#intentional = false;
    this.#open();
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
    this.#ws?.close();
    this.#ws = null;
  }

  // arrow field so setTimeout(this.#open, …) keeps `this`
  #open = () => {
    if (!this.#params) return;

    const existing = this.#ws;
    if (
      existing &&
      (existing.readyState === WebSocket.OPEN ||
        existing.readyState === WebSocket.CONNECTING)
    ) {
      return; // already up or coming up
    }

    const { name, colour } = this.#params;
    const qs = new URLSearchParams({ name, colour });
    const ws = new WebSocket(`${WS_URL}/ws?${qs.toString()}`);
    this.#ws = ws;

    ws.onopen = () => {
      this.#retry = 0;
      this.#statusHandler?.(true);
    };

    ws.onmessage = (e) => {
      try {
        this.#messageHandler?.(JSON.parse(e.data) as ServerMessage);
      } catch {
        // ignore malformed frames (server is ours; this shouldn't happen)
      }
    };

    ws.onclose = () => {
      this.#ws = null;
      this.#statusHandler?.(false);
      if (!this.#intentional) {
        const delay = Math.min(1000 * 2 ** this.#retry, 10000); // backoff, capped 10s
        this.#retry += 1;
        setTimeout(this.#open, delay);
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
