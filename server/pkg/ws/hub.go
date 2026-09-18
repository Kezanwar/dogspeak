package ws

import (
	"log/slog"
	"sync"
)

// Hub is all the server state there is: a flat map of every connected client,
// keyed by id. There is deliberately NO list of channels — a channel is just
// the string in each client's `channel` field. "Who's in lounge" is derived by
// filtering clients, never stored. The mutex guards clients AND the mutable
// fields on each Client (channel/name/colour), so only touch those through hub
// methods.
type Hub struct {
	mu      sync.Mutex
	clients map[string]*Client
}

// NewHub returns an empty hub ready to accept connections.
func NewHub() *Hub {
	return &Hub{clients: make(map[string]*Client)}
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
