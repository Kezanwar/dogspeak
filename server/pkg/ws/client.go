package ws

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/gorilla/websocket"
)

const (
	sendBuffer = 16

	// Connection safety limits.
	maxMessageSize = 16384            // bytes; fits an SDP offer, or a max-length chat message of multi-byte chars
	pongWait       = 60 * time.Second // no pong within this window => connection is dead
	pingPeriod     = 50 * time.Second // ping this often; must be < pongWait
	writeWait      = 10 * time.Second // max time allowed to write a single frame
)

// Client is one connected mate. id is fixed for the life of the socket; name,
// colour and channel are mutable presence and must only be touched under the
// hub's lock (see hub.go). channel == "" means they're in the lobby.
type Client struct {
	id      string
	name    string
	colour  string
	channel string
	muted   bool // self-muted mic; a fresh connection starts unmuted
	// uuid is the client's self-generated identity (sent at connect, kept in
	// its localStorage across reloads). Identity-LITE, not auth: it's
	// client-supplied and spoofable like the name — the room password is
	// the trust boundary. Falls back to id if the client didn't send one.
	uuid string
	conn *websocket.Conn
	send chan []byte
	hub  *Hub
}

// maxUUIDLen bounds the client-supplied uuid (a crypto.randomUUID is 36).
const maxUUIDLen = 64

func newClient(hub *Hub, conn *websocket.Conn, name, colour, uuid string) *Client {
	if name == "" {
		name = "anon"
	}
	if colour == "" {
		colour = "#8a8a8a"
	}
	id := randID()
	if uuid == "" || len(uuid) > maxUUIDLen {
		uuid = id // older/odd client: fall back to the ephemeral connection id
	}
	return &Client{
		id:      id,
		uuid:    uuid,
		name:    name,
		colour:  colour,
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

// writePump is the ONLY goroutine that writes to the socket. It drains the send
// queue and, on a ticker, sends pings — both to keep the connection alive and to
// detect a peer that's silently gone (no pong => the read deadline trips).
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel — send a close frame and stop.
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return // peer gone
			}
		}
	}
}

// readPump runs the presence handshake, then reads until the socket closes. It
// caps message size and enforces a read deadline that pongs keep resetting.
// Cleanup runs once, on any disconnect.
func (c *Client) readPump() {
	defer func() {
		c.hub.remove(c)
		c.hub.broadcastAll(c.id, encode(Message{Type: EventUserLeft, From: c.id}))
		close(c.send)
		slog.Info("ws disconnected", "id", c.id)
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(pongWait))
	})

	c.handshake()

	for {
		_, raw, err := c.conn.ReadMessage()
		if err != nil {
			return // disconnected / deadline / oversized frame -> deferred cleanup
		}

		var m Message
		if err := json.Unmarshal(raw, &m); err != nil {
			continue // ignore malformed frames
		}
		route(c, m)
	}
}

// handshake sends the newcomer the full roster and the global chat history,
// then announces them (sitting in the lobby) to everyone else. No WebRTC
// happens here — that starts once they join a voice channel.
func (c *Client) handshake() {
	c.hub.join(c) // queues session:welcome then chat:history
	c.hub.broadcastAll(c.id, encode(Message{
		Type: EventUserJoined, From: c.id, UUID: c.uuid,
		Name: c.name, Colour: c.colour, Channel: c.channel,
	}))
}

// randID returns a short random hex id for a client.
func randID() string {
	b := make([]byte, 6)
	rand.Read(b)
	return hex.EncodeToString(b)
}
