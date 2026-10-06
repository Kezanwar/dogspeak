package ws

import (
	"encoding/json"
	"log/slog"
	"sync"
	"time"
)

// chatHistoryLimit is how many recent messages each channel keeps.
const chatHistoryLimit = 30

// Hub is all the server state there is: a flat map of every connected client,
// keyed by id. There is deliberately NO list of channels — a channel is just
// the string in each client's `channel` field. "Who's in lounge" is derived by
// filtering clients, never stored. The mutex guards clients AND the mutable
// fields on each Client (channel/name/colour), so only touch those through hub
// methods.
//
// chat holds each channel's last chatHistoryLimit messages, also under mu. It's
// in-memory only (lost on restart) and kept when a channel empties, so
// rejoining still shows recent history.
type Hub struct {
	mu      sync.Mutex
	clients map[string]*Client
	chat    map[string][]ChatMessage
}

// NewHub returns an empty hub ready to accept connections.
func NewHub() *Hub {
	return &Hub{
		clients: make(map[string]*Client),
		chat:    make(map[string][]ChatMessage),
	}
}

// add registers a client and returns a snapshot of the whole roster (including
// the newcomer), keyed by id. Done under one lock so the snapshot is consistent.
func (h *Hub) add(c *Client) map[string]UserInfo {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.clients[c.id] = c

	roster := make(map[string]UserInfo, len(h.clients))
	for id, cl := range h.clients {
		roster[id] = UserInfo{Name: cl.name, Colour: cl.colour, Channel: cl.channel}
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

	if channel != "" {
		h.sendHistory(c, channel)
	}
}

// sendHistory sends c the channel's recent chat. The snapshot and the send
// happen under the lock that chat broadcasts also take, so the history can't
// land after (and wipe out) a live message that's newer than it.
func (h *Hub) sendHistory(c *Client, channel string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if c.channel != channel {
		return // they've already moved on
	}
	msgs := append([]ChatMessage{}, h.chat[channel]...)
	b, _ := json.Marshal(historyMessage{Type: EventChatHistory, Channel: channel, Messages: msgs})
	c.trySend(b)
}

// postChat stamps a message from c, stores it in c's channel's ring buffer, and
// sends it to everyone in that channel INCLUDING c (the sender sees their own
// message via this echo). Ignored in the lobby. text must already be cleaned.
func (h *Hub) postChat(c *Client, text string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	channel := c.channel
	if channel == "" {
		return
	}
	cm := ChatMessage{
		ID: randID(), From: c.id, Name: c.name, Colour: c.colour,
		Text: text, TS: time.Now().UnixMilli(),
	}

	buf := append(h.chat[channel], cm)
	if len(buf) > chatHistoryLimit {
		buf = append([]ChatMessage(nil), buf[len(buf)-chatHistoryLimit:]...) // drop oldest
	}
	h.chat[channel] = buf

	h.broadcastChannelLocked(channel, chatFrame(channel, cm))
	slog.Debug("chat message", "id", c.id, "channel", channel, "len", len(text))
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

// broadcastChannelLocked sends a message to EVERY client in channel, sender
// included — unlike broadcastAll, which is for presence and skips the sender.
// Caller must hold h.mu.
func (h *Hub) broadcastChannelLocked(channel string, msg []byte) {
	for _, c := range h.clients {
		if c.channel == channel {
			c.trySend(msg)
		}
	}
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
