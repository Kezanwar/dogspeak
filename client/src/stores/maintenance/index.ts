import { makeObservable, observable, action, runInAction } from "mobx";
import type { RootStore } from "@app/stores";
import { getStatus } from "@app/api/status";
import { audio } from "@app/audio/audio";
import { socket } from "@app/socket/socket";

/** How often a parked client re-checks /api/status. */
export const MAINTENANCE_POLL_MS = 7000;

/**
 * Maintenance mode, driven by GET /api/status (not a WS event — polling is
 * the source of truth). While `active`, the whole app is parked on the
 * maintenance screen (App.tsx), with no socket and no audio, and we poll
 * until the server says it's over; then the app restores itself.
 */
class MaintenanceStore {
  rootStore: RootStore;
  active = false;
  #pollTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    makeObservable(this, { active: observable, enter: action });
  }

  /** true/false from the server, or null if it couldn't be reached. */
  async check(): Promise<boolean | null> {
    try {
      const res = await getStatus();
      return typeof res.data?.maintenance === "boolean"
        ? res.data.maintenance
        : null; // e.g. an HTML 200 from a stale build
    } catch {
      return null; // server down / restarting — unknown, not "maintenance"
    }
  }

  /**
   * The socket's reconnect check (runs whenever the WS drops). Maintenance →
   * park and veto the reconnect; otherwise (off, or server unreachable) let
   * the normal backoff carry on.
   */
  allowReconnect = async (): Promise<boolean> => {
    if ((await this.check()) !== true) return true;
    this.enter();
    return false;
  };

  /**
   * Park everything. Audio is torn down HERE, explicitly (WebRTC is
   * peer-to-peer and would outlive the socket): every peer connection
   * closed, mic stopped. Then the socket, presence and chat go, and polling
   * starts. Idempotent.
   */
  enter() {
    if (this.active) return;
    audio.teardown(); // close peer connections (output) + stop the mic (input)
    socket.disconnect(); // intentional: no normal reconnect loop
    const { presence, chat, ui } = this.rootStore;
    presence.reset(); // nothing for the audio reaction to rebuild
    chat.reset();
    ui.viewText(); // come back on a fresh view
    this.active = true;
    this.#schedulePoll();
  }

  #schedulePoll() {
    if (this.#pollTimer) clearTimeout(this.#pollTimer);
    this.#pollTimer = setTimeout(this.#poll, MAINTENANCE_POLL_MS);
  }

  #poll = async () => {
    this.#pollTimer = null;
    if ((await this.check()) === false) {
      // Over: lift the gate. App remounts the normal tree, which re-checks
      // the session and reconnects (socket.connect resets its no-reconnect
      // flag), landing in the lobby like any fresh connection.
      runInAction(() => {
        this.active = false;
      });
      return;
    }
    this.#schedulePoll(); // still on, or unreachable mid-deploy: keep waiting
  };
}

export default MaintenanceStore;
