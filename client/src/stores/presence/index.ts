import { makeObservable, observable, action, computed } from "mobx";
import type { RootStore } from "@app/stores";
import type { ServerMessage, UserInfo } from "@app/socket/events";
import { EVENT } from "@app/socket/events";
import { socket } from "@app/socket/socket";
import { audio } from "@app/audio/audio";

class PresenceStore {
  rootStore: RootStore;

  myId = "";
  // Socket state for the status UI: open right now, and whether it has ever
  // opened this session (so "connecting…" vs "reconnecting…").
  connected = false;
  everConnected = false;
  // A newer session for my uuid (another tab, or a refresh elsewhere) took
  // over and the server closed this one. Gates the whole app (see App.tsx);
  // deliberately NOT cleared by reset(), only by continueHere().
  superseded = false;
  users = observable.map<string, UserInfo>(); // id -> presence

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    makeObservable(this, {
      myId: observable,
      connected: observable,
      everConnected: observable,
      superseded: observable,
      continueHere: action,
      setConnected: action,
      me: computed,
      byUuid: computed,
      myChannel: computed,
      apply: action,
      joinChannel: action,
      setName: action,
      setColour: action,
      setMuted: action,
      reset: action,
    });
  }

  // ── derived reads ──────────────────────────────────────────────
  get me(): UserInfo | undefined {
    return this.users.get(this.myId);
  }

  /** uuid -> currently-connected user (latest connection wins). */
  get byUuid(): Map<string, UserInfo> {
    const m = new Map<string, UserInfo>();
    for (const u of this.users.values()) m.set(u.uuid, u);
    return m;
  }

  get myChannel(): string {
    return this.me?.channel ?? "";
  }

  /** ids of everyone currently in a channel (''=lobby). Used by the sidebar. */
  membersInChannel(channel: string): string[] {
    const ids: string[] = [];
    for (const [id, u] of this.users) {
      if (u.channel === channel) ids.push(id);
    }
    return ids;
  }

  // ── incoming: apply a server message ───────────────────────────
  apply = (msg: ServerMessage) => {
    switch (msg.type) {
      case EVENT.SessionWelcome:
        this.myId = msg.to;
        // load the id-keyed roster (includes me); normalise muted defensively
        this.users.replace(
          Object.fromEntries(
            Object.entries(msg.users).map(([id, u]) => [
              id,
              // uuid falls back to the connection id (as the server does)
              { ...u, uuid: u.uuid || id, muted: u.muted === true },
            ]),
          ),
        );
        // A fresh connection is unmuted server-side; re-assert a persisted
        // self-mute now (sets my entry, sends user:mute, the audio manager
        // disables the track) so the room sees it right as we join.
        this.rootStore.audio.restoreSelfMute();
        break;
      case EVENT.UserJoined:
        this.users.set(msg.from, {
          uuid: msg.uuid || msg.from,
          name: msg.name,
          colour: msg.colour,
          channel: msg.channel ?? "", // omitted on the wire when "" (lobby)
          muted: false, // a fresh connection is always unmuted
        });
        break;
      case EVENT.UserLeft:
        this.users.delete(msg.from);
        break;
      case EVENT.UserChangeChannel:
        this.patch(msg.from, { channel: msg.channel ?? "" });
        break;
      case EVENT.UserChangeName:
        this.patch(msg.from, { name: msg.name });
        break;
      case EVENT.UserChangeColour:
        this.patch(msg.from, { colour: msg.colour });
        break;
      case EVENT.UserMute:
        this.patch(msg.from, { muted: true });
        break;
      case EVENT.UserUnmute:
        this.patch(msg.from, { muted: false });
        break;
      case EVENT.PeerOffer:
      case EVENT.PeerAnswer:
      case EVENT.PeerCandidate:
        // signalling — handled by the audio layer, not presence
        break;
      case EVENT.ChatMessage:
      case EVENT.ChatHistory:
        // chat — handled by ChatStore
        break;
      case EVENT.SessionSuperseded:
        // intercepted by the socket (stops reconnect → onSuperseded)
        break;
      default: {
        const _exhaustive: never = msg; // compile error if an event is unhandled
        return _exhaustive;
      }
    }
  };

  private patch(id: string, fields: Partial<UserInfo>) {
    const u = this.users.get(id);
    if (u) this.users.set(id, { ...u, ...fields });
  }

  // ── outgoing: change my OWN presence ───────────────────────────
  // The server broadcasts changes to everyone EXCEPT the sender, so we never
  // get our own change echoed back — we must update local state here too.
  joinChannel = (channel: string) => {
    this.patch(this.myId, { channel });
    socket.send({ type: EVENT.UserChangeChannel, channel });
  };

  // The server echoes presence changes to everyone EXCEPT the sender, so my
  // own chat snapshots are refreshed here (others' via ChatStore.apply).
  setName = (name: string) => {
    this.patch(this.myId, { name });
    this.#patchMyChat({ name });
    socket.updateParams({ name });
    socket.send({ type: EVENT.UserChangeName, name });
  };

  /** Self-mute flag: update my own entry AND broadcast (no echo comes back). */
  setMuted = (muted: boolean) => {
    this.patch(this.myId, { muted });
    socket.send({ type: muted ? EVENT.UserMute : EVENT.UserUnmute });
  };

  setColour = (colour: string) => {
    this.patch(this.myId, { colour });
    this.#patchMyChat({ colour });
    socket.updateParams({ colour });
    socket.send({ type: EVENT.UserChangeColour, colour });
  };

  #patchMyChat(patch: { name?: string } | { colour?: string }) {
    const uuid = this.me?.uuid;
    if (uuid && uuid !== this.myId)
      this.rootStore.chat.patchAuthor(uuid, patch);
  }

  // ── lifecycle ──────────────────────────────────────────────────
  connect(name: string, colour: string, uuid: string) {
    // Every frame goes to every consumer; each ignores what it doesn't own
    // (peer:* signalling goes to the imperative audio manager).
    socket.onMessage((msg) => {
      this.apply(msg);
      this.rootStore.chat.apply(msg);
      audio.handleMessage(msg);
    });
    socket.onStatus(this.setConnected);
    socket.onSuperseded(this.setSuperseded);
    socket.setReconnectCheck(this.rootStore.maintenance.allowReconnect);
    socket.connect({ name, colour, uuid });
  }

  /**
   * A newer session for my uuid took over (session:superseded frame or the
   * 4001 close — the socket has already stopped reconnecting). Tear
   * everything down HERE, explicitly, not via the dashboard's unmount:
   * WebRTC media is peer-to-peer and doesn't need the WS, so until the peer
   * connections close and the mic stops, this tab would keep sending and
   * receiving audio with nobody looking at it.
   */
  setSuperseded = action(() => {
    if (this.superseded) return;
    audio.teardown(); // close every peer connection (output) + stop the mic (input)
    socket.disconnect(); // drop the dead socket now; no reconnect either way
    // Clear my presence so the audio reaction, if it runs again before the
    // dashboard unmounts, syncs to "no channel" (teardown), never rebuilds.
    this.reset();
    this.rootStore.chat.reset();
    this.superseded = true;
  });

  /**
   * "continue here": reconnect this tab FRESH, landing in the lobby.
   * - dismisses the superseded screen (the dashboard remounts);
   * - its mount calls socket.connect(), which clears the no-reconnect flag
   *   the eviction set and opens a new socket;
   * - the server starts every connection in the lobby (channel ""), and we
   *   deliberately don't restore the previous voice channel — presence was
   *   reset on supersede, so there's nothing to rejoin. The view goes back to
   *   the default text channel too, as on a fresh load.
   * The new connection supersedes whichever tab is active now (newest wins).
   */
  continueHere() {
    this.rootStore.ui.viewText();
    this.superseded = false;
  }

  setConnected = (connected: boolean) => {
    this.connected = connected;
    if (connected) this.everConnected = true;
  };

  disconnect() {
    socket.disconnect();
    this.reset();
    this.rootStore.chat.reset();
  }

  reset = () => {
    this.myId = "";
    this.connected = false;
    this.everConnected = false;
    this.users.clear();
  };
}

export default PresenceStore;
