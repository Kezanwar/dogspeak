import { WS_URL } from "@app/config";
import { EVENT, type ClientMessage, type ServerMessage } from "./events";

type MessageHandler = (msg: ServerMessage) => void;
type StatusHandler = (connected: boolean) => void;

// Close code the server uses when a newer connection with our uuid evicts us
// (mirrors closeSuperseded in pkg/ws/client.go).
const CLOSE_SUPERSEDED = 4001;

class SocketClient {
  #ws: WebSocket | null = null;
  #messageHandler: MessageHandler | null = null;
  #statusHandler: StatusHandler | null = null;
  #supersededHandler: (() => void) | null = null;
  #reconnectCheck: (() => Promise<boolean>) | null = null;
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

  /**
   * Called (once per eviction) when another tab/refresh took over our
   * identity. The socket has already stopped reconnecting by then.
   */
  onSuperseded(fn: () => void) {
    this.#supersededHandler = fn;
  }

  /**
   * Asked on every unintentional drop, before the backoff reconnect:
   * resolve false to stop reconnecting (maintenance parks the app and polls
   * /api/status instead). Without one, drops always reconnect.
   */
  setReconnectCheck(fn: () => Promise<boolean>) {
    this.#reconnectCheck = fn;
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

  // Evicted by a newer session for our identity. Treat it like an
  // intentional disconnect — reconnecting would evict the other tab, which
  // would reconnect and evict us, forever. A network drop still reconnects.
  #superseded() {
    if (this.#intentional) return; // already handled (frame, then close)
    this.#intentional = true;
    if (this.#retryTimer) clearTimeout(this.#retryTimer);
    this.#retryTimer = null;
    this.#supersededHandler?.();
  }

  // A drop (not a logout / supersede): ask the reconnect check first — a
  // refused upgrade during maintenance lands here too — then back off.
  async #reconnect() {
    if (this.#reconnectCheck && !(await this.#reconnectCheck())) return;
    if (this.#intentional || this.#ws || this.#retryTimer) return; // changed meanwhile
    const delay = Math.min(1000 * 2 ** this.#retry, 10000); // backoff, capped 10s
    this.#retry += 1;
    this.#retryTimer = setTimeout(this.#open, delay);
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
      let msg: ServerMessage;
      try {
        msg = JSON.parse(e.data) as ServerMessage;
      } catch {
        return; // ignore malformed frames (server is ours; this shouldn't happen)
      }
      if (msg.type === EVENT.SessionSuperseded) {
        this.#superseded();
        return;
      }
      this.#messageHandler?.(msg);
    };

    ws.onclose = (e) => {
      if (this.#ws !== ws) return;
      // The 4001 close says the same as session:superseded, should that frame
      // have been dropped. Either way it's intentional — no reconnect.
      if (e.code === CLOSE_SUPERSEDED) this.#superseded();
      this.#ws = null;
      this.#statusHandler?.(false);
      if (!this.#intentional) void this.#reconnect();
    };

    ws.onerror = () => {
      ws.close(); // let onclose handle the reconnect
    };
  };
}

// One shared instance. It's a module export, not a global, so nothing on the
// console can reach it — and #ws is hard-private even if someone got the instance.
export const socket = new SocketClient();
