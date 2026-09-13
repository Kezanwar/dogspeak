package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

// Message is the envelope for everything on the wire.
// For relayed signalling (offer/answer/candidate), To names the target peer;
// the server stamps From so the recipient knows who sent it.
type Message struct {
	Type  string          `json:"type"`
	To    string          `json:"to,omitempty"`
	From  string          `json:"from,omitempty"`
	Data  json.RawMessage `json:"data,omitempty"`
	Peers []string        `json:"peers,omitempty"` // used by the server's "welcome" message
}

// Client is one connected mate: their socket, which room they're in,
// and a buffered channel of messages waiting to be written to them.
type Client struct {
	id   string
	room string
	conn *websocket.Conn
	send chan []byte
	hub  *Hub
}

// Hub is the whole server state: a map of room name -> (peer id -> client).
// The mutex guards it because many goroutines touch it at once.
type Hub struct {
	mu    sync.Mutex
	rooms map[string]map[string]*Client
}

func newHub() *Hub {
	return &Hub{rooms: make(map[string]map[string]*Client)}
}

// join adds c to its room and returns the IDs of peers already there.
func (h *Hub) join(c *Client) []string {
	h.mu.Lock()
	defer h.mu.Unlock()

	room := h.rooms[c.room]
	if room == nil {
		room = make(map[string]*Client)
		h.rooms[c.room] = room
	}

	existing := make([]string, 0, len(room))
	for id := range room {
		existing = append(existing, id)
	}

	room[c.id] = c
	return existing
}

// leave removes c and cleans up the room if it's now empty.
func (h *Hub) leave(c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	room := h.rooms[c.room]
	if room == nil {
		return
	}
	delete(room, c.id)
	if len(room) == 0 {
		delete(h.rooms, c.room)
	}
}

// sendTo delivers a raw message to one specific peer in a room.
func (h *Hub) sendTo(roomID, peerID string, msg []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if room := h.rooms[roomID]; room != nil {
		if c := room[peerID]; c != nil {
			select {
			case c.send <- msg:
			default: // drop if that client's buffer is stuck, don't block everyone
			}
		}
	}
}

// broadcast sends to everyone in the room except the excluded id.
func (h *Hub) broadcast(roomID, exclude string, msg []byte) {
	h.mu.Lock()
	defer h.mu.Unlock()
	for id, c := range h.rooms[roomID] {
		if id == exclude {
			continue
		}
		select {
		case c.send <- msg:
		default:
		}
	}
}

var upgrader = websocket.Upgrader{
	// Fine for a hobby project. Lock this down to your real origin later.
	CheckOrigin: func(r *http.Request) bool { return true },
}

func randID() string {
	b := make([]byte, 6)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func serveWS(hub *Hub, w http.ResponseWriter, r *http.Request) {
	// Room name comes from the query string, e.g. /ws?room=raid
	roomID := r.URL.Query().Get("room")
	if roomID == "" {
		roomID = "lobby"
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("upgrade:", err)
		return
	}

	c := &Client{
		id:   randID(),
		room: roomID,
		conn: conn,
		send: make(chan []byte, 16),
		hub:  hub,
	}

	// One goroutine writes, this goroutine reads. gorilla forbids concurrent
	// writes to a socket, so ALL writes go through writePump.
	go c.writePump()
	c.readPump()
}

// writePump is the only place that writes to the socket.
func (c *Client) writePump() {
	defer c.conn.Close()
	for msg := range c.send {
		if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
			return
		}
	}
}

// readPump does the join handshake, then relays signalling messages
// until the client disconnects.
func (c *Client) readPump() {
	defer func() {
		c.hub.leave(c)
		gone, _ := json.Marshal(Message{Type: "peer-left", From: c.id})
		c.hub.broadcast(c.room, c.id, gone)
		close(c.send) // ends writePump's range loop
	}()

	// 1. Join, then greet.
	existing := c.hub.join(c)

	// Tell the newcomer their own id + who's already here, so they know
	// how many offers to create.
	welcome, _ := json.Marshal(Message{Type: "welcome", To: c.id, Peers: existing})
	c.send <- welcome

	// Tell everyone else a new peer arrived.
	joined, _ := json.Marshal(Message{Type: "peer-joined", From: c.id})
	c.hub.broadcast(c.room, c.id, joined)

	// 2. Relay loop: forward each offer/answer/candidate to its target peer.
	for {
		_, raw, err := c.conn.ReadMessage()
		if err != nil {
			return // disconnected -> triggers the deferred cleanup above
		}

		var m Message
		if err := json.Unmarshal(raw, &m); err != nil {
			continue // ignore anything malformed
		}

		m.From = c.id // stamp the sender so the recipient knows who it's from
		out, _ := json.Marshal(m)
		if m.To != "" {
			c.hub.sendTo(c.room, m.To, out)
		}
	}
}

func main() {
	hub := newHub()
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWS(hub, w, r)
	})
	log.Println("signalling server listening on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
