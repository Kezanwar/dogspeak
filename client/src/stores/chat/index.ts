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
      case EVENT.SessionWelcome:
      case EVENT.UserJoined:
      case EVENT.UserLeft:
      case EVENT.UserChangeChannel:
      case EVENT.UserChangeName:
      case EVENT.UserChangeColour:
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
