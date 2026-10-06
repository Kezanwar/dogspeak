// Typed mirror of docs/events.md — the wire contract with the Go server.
// Keep this in sync with pkg/ws/message.go on the backend.
//
// Two directions, two unions:
//   ServerMessage  — what the server sends us (dispatch on `type`)
//   ClientMessage  — what we send the server (constructed, never has `from`)
// The server always stamps `from` itself, so it appears on incoming events only.

/** Event name constants — mirror the Go `Event*` consts. Use these, not string literals. */
export const EVENT = {
  SessionWelcome: "session:welcome",
  UserJoined: "user:joined",
  UserLeft: "user:left",
  UserChangeChannel: "user:change_channel",
  UserChangeName: "user:change_name",
  UserChangeColour: "user:change_colour",
  PeerOffer: "peer:offer",
  PeerAnswer: "peer:answer",
  PeerCandidate: "peer:candidate",
} as const;

export type EventType = (typeof EVENT)[keyof typeof EVENT];

/** One person's public presence. `channel: ''` means the lobby (no channel). */
export interface UserInfo {
  name: string;
  colour: string;
  channel: string;
}

// ─── Server → client (incoming) ────────────────────────────────────────────

/** session:welcome — full roster snapshot to the newcomer. `to` is your own id. */
export interface WelcomeMessage {
  type: typeof EVENT.SessionWelcome;
  to: string;
  users: Record<string, UserInfo>; // id-keyed; includes you
}

// NB: the server's envelope tags `channel` with omitempty, so the lobby ("")
// arrives as a MISSING field on user:joined / user:change_channel. Treat
// `undefined` as "" when applying these.

/** user:joined — someone connected (lands in the lobby). */
export interface UserJoinedMessage {
  type: typeof EVENT.UserJoined;
  from: string;
  name: string;
  colour: string;
  channel?: string;
}

/** user:left — someone disconnected. */
export interface UserLeftMessage {
  type: typeof EVENT.UserLeft;
  from: string;
}

/** user:change_channel — someone moved channel (`''` = back to lobby). */
export interface UserChangeChannelMessage {
  type: typeof EVENT.UserChangeChannel;
  from: string;
  channel?: string;
}

/** user:change_name — someone renamed. */
export interface UserChangeNameMessage {
  type: typeof EVENT.UserChangeName;
  from: string;
  name: string;
}

/** user:change_colour — someone recoloured. */
export interface UserChangeColourMessage {
  type: typeof EVENT.UserChangeColour;
  from: string;
  colour: string;
}

/** peer:offer / peer:answer — SDP relayed from one channel-mate. */
export interface PeerOfferMessage {
  type: typeof EVENT.PeerOffer;
  from: string;
  to: string;
  data: RTCSessionDescriptionInit;
}
export interface PeerAnswerMessage {
  type: typeof EVENT.PeerAnswer;
  from: string;
  to: string;
  data: RTCSessionDescriptionInit;
}

/** peer:candidate — ICE candidate relayed from one channel-mate. */
export interface PeerCandidateMessage {
  type: typeof EVENT.PeerCandidate;
  from: string;
  to: string;
  data: RTCIceCandidateInit;
}

/** Everything the server can send. Narrow on `.type`. */
export type ServerMessage =
  | WelcomeMessage
  | UserJoinedMessage
  | UserLeftMessage
  | UserChangeChannelMessage
  | UserChangeNameMessage
  | UserChangeColourMessage
  | PeerOfferMessage
  | PeerAnswerMessage
  | PeerCandidateMessage;

// ─── Client → server (outgoing) ─────────────────────────────────────────────
// No `from` — the server stamps it. Presence changes carry just their payload.

export interface ChangeChannelOut {
  type: typeof EVENT.UserChangeChannel;
  channel: string;
}
export interface ChangeNameOut {
  type: typeof EVENT.UserChangeName;
  name: string;
}
export interface ChangeColourOut {
  type: typeof EVENT.UserChangeColour;
  colour: string;
}

export interface PeerOfferOut {
  type: typeof EVENT.PeerOffer;
  to: string;
  data: RTCSessionDescriptionInit;
}
export interface PeerAnswerOut {
  type: typeof EVENT.PeerAnswer;
  to: string;
  data: RTCSessionDescriptionInit;
}
export interface PeerCandidateOut {
  type: typeof EVENT.PeerCandidate;
  to: string;
  data: RTCIceCandidateInit;
}

/** Everything we can send. */
export type ClientMessage =
  | ChangeChannelOut
  | ChangeNameOut
  | ChangeColourOut
  | PeerOfferOut
  | PeerAnswerOut
  | PeerCandidateOut;
