import { makeObservable, observable, action, computed } from "mobx";
import type { RootStore } from "@app/stores";
import type { ServerMessage, UserInfo } from "@app/socket/events";
import { EVENT } from "@app/socket/events";
import { socket } from "@app/socket/socket";
import { audio } from "@app/audio/audio";

class PresenceStore {
  rootStore: RootStore;

  myId = "";
  users = observable.map<string, UserInfo>(); // id -> presence

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    makeObservable(this, {
      myId: observable,
      me: computed,
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
              { ...u, muted: u.muted === true },
            ]),
          ),
        );
        break;
      case EVENT.UserJoined:
        this.users.set(msg.from, {
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

  setName = (name: string) => {
    this.patch(this.myId, { name });
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
    socket.updateParams({ colour });
    socket.send({ type: EVENT.UserChangeColour, colour });
  };

  // ── lifecycle ──────────────────────────────────────────────────
  connect(name: string, colour: string) {
    // Every frame goes to every consumer; each ignores what it doesn't own
    // (peer:* signalling goes to the imperative audio manager).
    socket.onMessage((msg) => {
      this.apply(msg);
      this.rootStore.chat.apply(msg);
      audio.handleMessage(msg);
    });
    socket.connect({ name, colour });
  }

  disconnect() {
    socket.disconnect();
    this.reset();
    this.rootStore.chat.reset();
  }

  reset = () => {
    this.myId = "";
    this.users.clear();
  };
}

export default PresenceStore;
