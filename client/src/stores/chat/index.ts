import { makeObservable, observable, action } from "mobx";
import type { RootStore } from "@app/stores";
import type { ChatMessage, ServerMessage } from "@app/socket/events";
import { EVENT } from "@app/socket/events";
import { socket } from "@app/socket/socket";

// The ONE global text chat — independent of voice channels, usable from the
// lobby. The server sends a chat:history snapshot on connect, then every
// chat:message to everyone.
class ChatStore {
  rootStore: RootStore;

  /** Oldest first. */
  messages: ChatMessage[] = [];

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    makeObservable(this, {
      messages: observable,
      apply: action,
      patchAuthor: action,
      reset: action,
    });
  }

  // ── incoming ───────────────────────────────────────────────────
  apply = (msg: ServerMessage) => {
    switch (msg.type) {
      case EVENT.ChatMessage: {
        const { id, from, authorId, name, colour, text, ts } = msg;
        this.messages.push({ id, from, authorId, name, colour, text, ts });
        break;
      }
      case EVENT.ChatHistory:
        this.messages = msg.messages ?? [];
        break;
      // Someone else renamed / recoloured: refresh the snapshots on their past
      // messages too (presence has already been patched; the uuid is stable).
      case EVENT.UserChangeName:
      case EVENT.UserChangeColour: {
        const u = this.rootStore.presence.users.get(msg.from);
        if (u && u.uuid !== msg.from) {
          this.patchAuthor(
            u.uuid,
            msg.type === EVENT.UserChangeName
              ? { name: msg.name }
              : { colour: msg.colour },
          );
        }
        break;
      }
      case EVENT.SessionWelcome:
      case EVENT.SessionSuperseded:
      case EVENT.UserJoined:
      case EVENT.UserLeft:
      case EVENT.UserChangeChannel:
      case EVENT.UserMute:
      case EVENT.UserUnmute:
      case EVENT.PeerOffer:
      case EVENT.PeerAnswer:
      case EVENT.PeerCandidate:
        // presence / signalling — not chat
        break;
      default: {
        const _exhaustive: never = msg; // compile error if an event is unhandled
        return _exhaustive;
      }
    }
  };

  /**
   * Rewrite the name/colour snapshot on every message by this author (uuid),
   * mirroring the server's rewrite of its buffer. Keeps the fallback (used
   * once the author disconnects) as current as the live lookup, for people
   * who were already here when the change happened. A fallback uuid (= a
   * connection id) is never passed in, matching the server.
   */
  patchAuthor(
    uuid: string,
    patch: Partial<Pick<ChatMessage, "name" | "colour">>,
  ) {
    for (const m of this.messages) {
      if (m.authorId === uuid) Object.assign(m, patch);
    }
  }

  // ── outgoing ───────────────────────────────────────────────────
  // No optimistic add: the server echoes our own message back to us.
  send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    socket.send({ type: EVENT.ChatMessage, text: trimmed });
  };

  reset = () => {
    this.messages = [];
  };
}

export default ChatStore;
