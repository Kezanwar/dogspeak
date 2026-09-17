# Events

The single source of truth for every message on the WebSocket. Go and JS don't
share code, so **this file is the contract** — both ends implement against it.
Keep the constants in `pkg/ws/message.go` and the frontend store in sync with
this list.

## The two scopes

Everything divides into two buckets, and the server treats them differently:

- **Presence** — who's online, their name/colour, and which channel they're in.
  This is **server-wide**: every delta is broadcast to _everyone connected_,
  whatever channel they're in, so every client can draw the full lobby roster.
- **Signalling** — the WebRTC offer/answer/ICE handshake. This is
  **channel-scoped**: the server only relays it between two peers who share the
  same (non-empty) channel. That's what forms an audio mesh _within_ a channel
  and never across channels.

The server has **no list of channels**. A channel is just the string in each
client's `channel` field (`""` = lobby). The three channels (General, Lounge,
AFK) live entirely in the frontend. AFK is a normal channel to the server; the
_client_ chooses not to capture audio while in it.

## Envelope

```json
{ "type": "...", "to": "...", "from": "...",
  "name": "...", "colour": "...", "channel": "...",
  "data": { ... }, "users": { "<id>": { ... } } }
```

- `from` — sender id. **Stamped by the server**, never trusted from the client.
- `to` — target peer id, on signalling events only (also carries your own id on `welcome`).
- `name` / `colour` / `channel` — typed payloads the server reads to keep presence current.
- `data` — the ONE opaque field: SDP / ICE for signalling, forwarded unread.
- `users` — the roster, an object keyed by id, on `welcome` only. The id is the
  key, so it isn't repeated inside each value — mirroring the frontend's id-keyed
  observable map.

---

## Presence (server-wide)

| Event                 | Direction  | Payload                                    | Receiver does                                                      |
| --------------------- | ---------- | ------------------------------------------ | ------------------------------------------------------------------ |
| `session:welcome`     | S→newcomer | `users: { "<id>": {name,colour,channel} }` | Load the roster into the store (id-keyed); your own id is in `to`. |
| `user:joined`         | S→others   | `from`, `name`, `colour`, `channel`        | Add this person to the roster (they're in the lobby).              |
| `user:left`           | S→others   | `from`                                     | Remove them; if you had a peer connection to them, close it.       |
| `user:change_channel` | both ways  | `channel` (`""` = lobby)                   | Update that person's channel. See mesh rules below.                |
| `user:change_name`    | both ways  | `name`                                     | Update that person's name.                                         |
| `user:change_colour`  | both ways  | `colour`                                   | Update that person's colour.                                       |

"Both ways" = the client sends it with just the payload; the server stamps
`from` and broadcasts it to everyone else.

A `session:welcome` frame looks like this (`to` is your own id; `users` includes you):

```json
{
  "type": "session:welcome",
  "to": "a1b2c3",
  "users": {
    "a1b2c3": { "name": "Kez", "colour": "#ff8800", "channel": "general" },
    "d4e5f6": { "name": "Dave", "colour": "#0088ff", "channel": "" }
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

## Mesh rules (frontend)

The server never tells you who to connect to — you derive it from the roster
you already hold. Two rules keep it glare-free:

1. **When you change channel, YOU offer to everyone already in that channel.**
   Filter your roster to peers with the same channel, create a `peer:offer` to each.
2. **When someone else's `user:change_channel` lands you in the same channel, wait.**
   Don't offer to them — they'll offer to you (rule 1). Just prepare to answer.

Leaving/switching a channel: tear down every peer connection for that channel,
then apply rule 1 for the new one. A `user:left` or a `user:change_channel` that
moves someone out of your channel is your cue to close that peer connection.

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
