# Events

The single source of truth for every message on the WebSocket. Go and JS don't
share code, so **this file is the contract** — both ends implement against it.
Keep the constants in `pkg/ws/message.go` and the frontend store in sync with
this list.

## The two scopes

Everything divides into buckets, and the server treats them differently:

- **Presence** — who's online, their name/colour, and which channel they're in.
  This is **server-wide**: every delta is broadcast to _everyone connected_,
  whatever channel they're in, so every client can draw the full lobby roster.
- **Signalling** — the WebRTC offer/answer/ICE handshake. This is
  **channel-scoped**: the server only relays it between two peers who share the
  same (non-empty) channel. That's what forms an audio mesh _within_ a channel
  and never across channels.
- **Chat** — text messages. **Global**: one chat for everyone connected,
  independent of voice channels (usable from the lobby too). It never reads or
  carries `channel`.

The server has **no list of channels**. A channel is just the string in each
client's `channel` field (`""` = lobby). The three channels (General, Lounge,
AFK) live entirely in the frontend. AFK is a normal channel to the server; the
_client_ chooses not to capture audio while in it.

## Envelope

```json
{ "type": "...", "to": "...", "from": "...",
  "name": "...", "colour": "...", "channel": "...",
  "data": { ... }, "users": { "<id>": { ... } },
  "uuid": "...", "authorId": "...",
  "id": "...", "text": "...", "ts": 0 }
```

- `from` — sender id. **Stamped by the server**, never trusted from the client.
- `to` — target peer id, on signalling events only (also carries your own id on `welcome`).
- `name` / `colour` / `channel` — typed payloads the server reads to keep presence current.
- `data` — the ONE opaque field: SDP / ICE for signalling, forwarded unread.
- `users` — the roster, an object keyed by id, on `welcome` only. The id is the
  key, so it isn't repeated inside each value — mirroring the frontend's id-keyed
  observable map.
- `uuid` — the newcomer's client identity, on `user:joined` only (see Identity).
- `authorId` / `id` / `text` / `ts` — chat fields (`ts` is unix millis), on `chat:message` only.

Empty fields are **omitted** on the wire. In particular `channel: ""` (the lobby)
never appears — treat a missing `channel` as `""`.

## Identity (client uuid — identity-LITE, not auth)

Each browser generates a uuid once (`crypto.randomUUID()`), keeps it in
localStorage next to its name/colour (it survives reloads and re-login; it is
never cleared on logout), and sends it **at connect** as a `uuid` query param
on `/ws`, alongside `name` and `colour`. It's a connect param, not a message.

- The server stores it on the connection and exposes it as `uuid` in the
  roster's `UserInfo` and on `user:joined`, and as `authorId` on chat messages.
  A client that sends none (or junk over 64 chars) gets its connection id as its uuid.
- **It is spoofable** — client-supplied, exactly like `name`. It is NOT a
  security boundary: the room password (session cookie) is. Fine for a few
  trusted mates; don't build anything on it that assumes it can't be faked.
- What it's for: chat ownership that survives a reload ("is this mine?" =
  `authorId === my uuid`), rendering each message's name/colour **live** from
  whoever currently has that uuid (falling back to the message's own snapshot
  when they've disconnected), and keying your **local** per-person mute/volume
  so it sticks across their reconnects. Those local settings are persisted in
  your browser and never broadcast.

The connection id (`from`, roster keys, `to` for signalling) is still the
per-connection address; the uuid is the per-person identity behind it.

---

## Presence (server-wide)

| Event                 | Direction  | Payload                                    | Receiver does                                                      |
| --------------------- | ---------- | ------------------------------------------ | ------------------------------------------------------------------ |
| `session:welcome`     | S→newcomer | `users: { "<id>": {uuid,name,colour,channel,muted} }` | Load the roster into the store (id-keyed); your own id is in `to`. |
| `user:joined`         | S→others   | `from`, `uuid`, `name`, `colour`, `channel` | Add this person to the roster (they're in the lobby).             |
| `user:left`           | S→others   | `from`                                     | Remove them; if you had a peer connection to them, close it.       |
| `user:change_channel` | both ways  | `channel` (`""` = lobby)                   | Update that person's channel. See mesh rules below.                |
| `user:change_name`    | both ways  | `name`                                     | Update that person's name.                                         |
| `user:change_colour`  | both ways  | `colour`                                   | Update that person's colour.                                       |
| `user:mute`           | both ways  | _(none)_                                   | Mark that person self-muted (show their muted icon).               |
| `user:unmute`         | both ways  | _(none)_                                   | Mark that person unmuted.                                          |

"Both ways" = the client sends it with just the payload; the server stamps
`from` and broadcasts it to everyone else.

**Self-mute** is two payload-less events, `user:mute` / `user:unmute` — the
event type carries the state. A single event with `muted: bool` can't ride the
shared envelope: `false` is meaningful but would be dropped by `omitempty` (the
same trap as `channel: ""`). The roster's `muted` is a plain field (no
`omitempty`), so a newcomer sees who's already muted; `user:joined` omits it
because a fresh connection is always unmuted. Mute is a presence fact about the
connection, so it survives channel switches.

Local-only audio controls — muting someone _for yourself_, per-person volume,
your output volume and mic gain — never cross the wire. Per-person mute/volume
are keyed by the other person's **uuid** (not their connection id) and
persisted locally, so they survive both their reconnects and your reloads. One coupling: dragging your
mic gain to 0% self-mutes you (sending the ordinary `user:mute`) and raising it
from 0% unmutes — no extra event or field.

A `session:welcome` frame looks like this (`to` is your own id; `users` includes you):

```json
{
  "type": "session:welcome",
  "to": "a1b2c3",
  "users": {
    "a1b2c3": { "uuid": "7f3c…", "name": "Kez", "colour": "#ff8800", "channel": "general", "muted": false },
    "d4e5f6": { "uuid": "b91e…", "name": "Dave", "colour": "#0088ff", "channel": "", "muted": true }
  }
}
```

## Signalling (channel-scoped relay)

| Event            | Direction | Payload (`data`) | Receiver does                   |
| ---------------- | --------- | ---------------- | ------------------------------- |
| `peer:offer`     | relay     | SDP offer        | `setRemoteDescription`, answer. |
| `peer:answer`    | relay     | SDP answer       | `setRemoteDescription`.         |
| `peer:candidate` | relay     | ICE candidate    | `addIceCandidate`.              |

The server drops any of these whose `to` peer isn't in the sender's channel, so
you can't accidentally signal across channels.

---

## Chat (global)

| Event          | Direction                                    | Payload                                                    | Receiver does          |
| -------------- | -------------------------------------------- | ---------------------------------------------------------- | ---------------------- |
| `chat:message` | C→S                                          | `text`                                                     | —                      |
| `chat:message` | S→everyone (sender included)                 | `id`, `from`, `authorId`, `name`, `colour`, `text`, `ts`   | Append to the messages. |
| `chat:history` | S→newcomer, right after `session:welcome`    | `messages: ChatMessage[]` (always present, may be `[]`)    | Replace the messages.  |

Chat is **not tied to voice channels**: neither event has a `channel`, anyone
connected can post (lobby included), and switching voice channel doesn't touch
it. `chat:history` is a **connect-time** frame — you get it once, immediately
after `session:welcome` (queued under the same lock as chat broadcasts, so a
message sent while you connect is either in the history or arrives after it,
never lost) — not on voice-channel join.

`ChatMessage` is `{ id, from, authorId, name, colour, text, ts }`:

- `id` — short server-generated id (use it as the React key).
- `authorId` — the sender's client uuid (see Identity). Ownership is
  `authorId === my uuid`; render name/colour **live** from the connected user
  with that uuid.
- `name` / `colour` — **snapshotted** by the server when the message is sent:
  the fallback when the author isn't currently connected.
- `ts` — unix millis, stamped by the server.

Rules:

- The client sends **only** `text`. The server stamps everything else.
- The sender gets their own message back via the broadcast — **don't** add it
  optimistically.
- The server trims `text`, drops empty/whitespace-only messages and caps it at
  2000 characters.
- The server keeps the last **30** messages in memory (lost on restart).

---

## Mesh rules (frontend)

The server never tells you who to connect to — you derive it from the roster
you already hold. Audio only runs in channels with audio (`general`, `lounge`);
in `afk` and the lobby there's no mic and no peer connections.

**Who offers — by id, not by who joined last.** For every pair of peers that
share an audio channel, the one with the lexicographically **smaller id**
creates the `peer:offer`; the larger id never offers, it waits and answers.
Both sides derive the same answer from the ids, so two offers can never cross
("glare"), whichever order people joined in.

1. Whenever your channel or its member list changes, work out the peers you
   should be connected to: everyone else in your audio channel.
2. For each new peer, create the `RTCPeerConnection` up front (mic track added,
   ICE/track handlers wired). If `myId < theirId`, send them a `peer:offer`;
   otherwise wait for theirs and reply with a `peer:answer`.
3. ICE candidates (`peer:candidate`) can arrive before the remote description is
   set — buffer them per peer and add them once it is.
4. Close the connection for anyone no longer in your channel (`user:left`, or a
   `user:change_channel` that moves them out).

Leaving/switching a channel: close every peer connection and release the mic,
then (if the new channel has audio) re-acquire it and apply the rules above.

**Mic retry:** if your mic was blocked and a retry succeeds, your existing
connections are receive-only. Rebuild instead of renegotiating: close them and
send a fresh `peer:offer` to everyone in the channel, whatever the ids (they're
idle, so there's no glare). A peer that gets an offer for a connection it has
already negotiated replaces it and answers.

**AFK / no audio:** joining `afk` is a normal `user:change_channel`; the client
just skips `getUserMedia` and opens no peer connections. You appear present, silent.

**Talking highlight:** not a server event. In a mesh you already receive each
channel-mate's audio directly, so measure the level of each incoming stream (and
your own mic) locally with a Web Audio `AnalyserNode`. No `speaking` event needs
to cross the wire.

---

## Adding a new event

1. Add a row above (name, direction, payload, effect).
2. Add the constant to `pkg/ws/message.go`.
3. Add a `case` to `route()` in `pkg/ws/router.go` (relay or presence bucket).
4. Handle it in the frontend store.
