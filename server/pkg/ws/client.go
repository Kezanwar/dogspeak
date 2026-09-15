package ws

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"

	"github.com/gorilla/websocket"
)

// sendBuffer is how many outbound messages we queue per client before dropping.
// A full buffer means a stuck connection, and we'd rather drop that client's
// messages than block the whole hub.
const sendBuffer = 16

// Client is one connected mate. id is fixed for the life of the socket; name,
// color and channel are mutable presence and must only be touched under the
// hub's lock (see hub.go). channel == "" means they're in the lobby.
type Client struct {
	id      string
	name    string
	color   string
	channel string
	conn    *websocket.Conn
	send    chan []byte
	hub     *Hub
}

func newClient(hub *Hub, conn *websocket.Conn, name, color string) *Client {
	if name == "" {
		name = "anon"
	}
	if color == "" {
		color = "#8a8a8a"
	}
	return &Client{
		id:      randID(),
		name:    name,
		color:   color,
		channel: "", // start in the lobby, not in any channel
		conn:    conn,
		send:    make(chan []byte, sendBuffer),
		hub:     hub,
	}
}

// trySend queues a message without blocking; drops it if the buffer is full.
func (c *Client) trySend(msg []byte) {
	select {
	case c.send <- msg:
	default:
	}
}

// writePump is the ONLY goroutine that writes to the socket — gorilla forbids
// concurrent writes, so everything outbound funnels through here.
func (c *Client) writePump() {
	defer c.conn.Close()
	for msg := range c.send {
		if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			return
		}
	}
}

// readPump runs the presence handshake, then reads until the socket closes,
// handing each message to the router. Cleanup runs once, on any disconnect.
func (c *Client) readPump() {
	defer func() {
		c.hub.remove(c)
		c.hub.broadcastAll(c.id, encode(Message{Type: EventUserLeft, From: c.id}))
		close(c.send)
	}()

	c.handshake()

	for {
		_, raw, err := c.conn.ReadMessage()
		if err != nil {
			return
		}

		var m Message
		if err := json.Unmarshal(raw, &m); err != nil {
			continue // ignore malformed frames
		}
		route(c, m)
	}
}

// handshake sends the newcomer the full roster, then announces them (sitting in
// the lobby) to everyone else. No WebRTC happens here — that only starts once
// they join a channel.
func (c *Client) handshake() {
	roster := c.hub.add(c)
	c.trySend(encode(Message{Type: EventWelcome, To: c.id, Users: roster}))
	c.hub.broadcastAll(c.id, encode(Message{
		Type: EventUserJoined, From: c.id,
		Name: c.name, Color: c.color, Channel: c.channel,
	}))
}

// randID returns a short random hex id for a client.
func randID() string {
	b := make([]byte, 6)
	rand.Read(b)
	return hex.EncodeToString(b)
}
