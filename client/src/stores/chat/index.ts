import { makeObservable, observable, action } from "mobx";
import type { RootStore } from "@app/stores";
import type { ChatMessage, ServerMessage } from "@app/socket/events";
import { EVENT } from "@app/socket/events";
import { socket } from "@app/socket/socket";

// Channel-scoped text chat. The server only sends us chat for the channel we're
// in, plus a chat:history snapshot each time we join one.
class ChatStore {
  rootStore: RootStore;

  messagesByChannel = observable.map<string, ChatMessage[]>();

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    makeObservable(this, {
      apply: action,
      reset: action,
    });
  }

  /** Messages for a channel, oldest first. */
  messagesIn(channel: string): ChatMessage[] {
    return this.messagesByChannel.get(channel) ?? [];
  }

  // ── incoming ───────────────────────────────────────────────────
  apply = (msg: ServerMessage) => {
    switch (msg.type) {
      case EVENT.ChatMessage: {
        const { channel, id, from, name, colour, text, ts } = msg;
        const message: ChatMessage = { id, from, name, colour, text, ts };
        const list = this.messagesByChannel.get(channel);
        if (list) list.push(message);
        else this.messagesByChannel.set(channel, [message]);
        break;
      }
      case EVENT.ChatHistory:
        this.messagesByChannel.set(msg.channel, msg.messages ?? []);
        break;
      case EVENT.SessionWelcome:
      case EVENT.UserJoined:
      case EVENT.UserLeft:
      case EVENT.UserChangeChannel:
      case EVENT.UserChangeName:
      case EVENT.UserChangeColour:
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
    this.messagesByChannel.clear();
  };
}

export default ChatStore;
