package ws

import (
	"encoding/json"
	"log/slog"
	"sync"
	"time"
)

// chatHistoryLimit is how many recent chat messages the server keeps.
const chatHistoryLimit = 30

// Hub is all the server state there is: a flat map of every connected client,
// keyed by id. There is deliberately NO list of channels — a channel is just
// the string in each client's `channel` field. "Who's in lounge" is derived by
// filtering clients, never stored. The mutex guards clients AND the mutable
// fields on each Client (channel/name/colour), so only touch those through hub
// methods.
//
// chat holds the last chatHistoryLimit messages of the ONE global text chat,
// also under mu. In-memory only (lost on restart). Chat is independent of voice
// channels: everyone connected can read and post, lobby included.
type Hub struct {
	mu      sync.Mutex
	clients map[string]*Client
	chat    []ChatMessage
}

// NewHub returns an empty hub ready to accept connections.
func NewHub() *Hub {
	return &Hub{
		clients: make(map[string]*Client),
	}
}

// add registers a client and returns a snapshot of the whole roster (including
// the newcomer), keyed by id. Done under one lock so the snapshot is consistent.
func (h *Hub) add(c *Client) map[string]UserInfo {
	h.mu.Lock()
	defer h.mu.Unlock()
	return h.addLocked(c)
}

// join registers a newcomer and queues their session:welcome followed by the
// chat:history, all under the lock chat broadcasts also take — so a message
// posted at the same instant is either in the history snapshot or queued
// strictly after it, never before it (where the history would wipe it out).
func (h *Hub) join(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	roster := h.addLocked(c)
	c.trySend(encode(Message{Type: EventSessionWelcome, To: c.id, Users: roster}))
	b, _ := json.Marshal(historyMessage{
		Type:     EventChatHistory,
		Messages: append([]ChatMessage{}, h.chat...),
	})
	c.trySend(b)
}

func (h *Hub) addLocked(c *Client) map[string]UserInfo {
	h.clients[c.id] = c

	roster := make(map[string]UserInfo, len(h.clients))
	for id, cl := range h.clients {
		roster[id] = UserInfo{UUID: cl.uuid, Name: cl.name, Colour: cl.colour, Channel: cl.channel, Muted: cl.muted}
	}
	return roster
}

// remove deletes a client from the hub.
func (h *Hub) remove(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	delete(h.clients, c.id)
}

// changeChannel updates a client's channel, then tells everyone (server-wide,
// so every lobby view updates). Passing "" moves them back to the lobby.
func (h *Hub) changeChannel(c *Client, channel string) {
	h.mu.Lock()
	c.channel = channel
	h.mu.Unlock()
	slog.Debug("channel change", "id", c.id, "channel", channel)
	h.broadcastAll(c.id, encode(Message{Type: EventUserChangeChannel, From: c.id, Channel: channel}))
}

// postChat stamps a message from c, stores it in the global ring buffer, and
// sends it to EVERY connected client including c (the sender sees their own
// message via this echo). Chat isn't tied to voice channels, so anyone can
// post — lobby included. text must already be cleaned.
func (h *Hub) postChat(c *Client, text string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	cm := ChatMessage{
		ID: randID(), From: c.id, AuthorID: c.uuid, Name: c.name, Colour: c.colour,
		Text: text, TS: time.Now().UnixMilli(),
	}

	h.chat = append(h.chat, cm)
	if len(h.chat) > chatHistoryLimit {
		h.chat = append([]ChatMessage(nil), h.chat[len(h.chat)-chatHistoryLimit:]...) // drop oldest
	}

	frame := chatFrame(cm)
	for _, cl := range h.clients {
		cl.trySend(frame)
	}
	slog.Debug("chat message", "id", c.id, "len", len(text))
}

// changeName updates a client's name and broadcasts the delta.
func (h *Hub) changeName(c *Client, name string) {
	h.mu.Lock()
	c.name = name
	h.mu.Unlock()
	h.broadcastAll(c.id, encode(Message{Type: EventUserChangeName, From: c.id, Name: name}))
}

// changeColour updates a client's colour and broadcasts the delta.
func (h *Hub) changeColour(c *Client, colour string) {
	h.mu.Lock()
	c.colour = colour
	h.mu.Unlock()
	h.broadcastAll(c.id, encode(Message{Type: EventUserChangeColour, From: c.id, Colour: colour}))
}

// setMuted records a client's self-mute and broadcasts it as user:mute or
// user:unmute (no payload — the event type carries the state).
func (h *Hub) setMuted(c *Client, muted bool) {
	h.mu.Lock()
	c.muted = muted
	h.mu.Unlock()
	ev := EventUserUnmute
	if muted {
		ev = EventUserMute
	}
	h.broadcastAll(c.id, encode(Message{Type: ev, From: c.id}))
}

// relayToPeer forwards a signalling message to one peer — but ONLY if that peer
// shares the sender's channel (and the sender is actually in a channel). This is
// what keeps the General mesh from wiring up to people sitting in Lounge.
func (h *Hub) relayToPeer(from *Client, toID string, msg []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()

	to := h.clients[toID]
	if to == nil || from.channel == "" || to.channel != from.channel {
		return
	}
	to.trySend(msg)
}

// broadcastAll sends a message to every connected client except exclude.
// Presence is server-wide, so deltas go to everyone regardless of channel.
func (h *Hub) broadcastAll(exclude string, msg []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()

	for id, c := range h.clients {
		if id == exclude {
			continue
		}
		c.trySend(msg)
	}
}
