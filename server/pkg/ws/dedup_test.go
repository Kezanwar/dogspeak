package ws

import (
	"encoding/json"
	"errors"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

// withUUID is newcomer with an explicit uuid (two tabs share one).
func withUUID(h *Hub, id, uuid string) *Client {
	c := newcomer(h, id, id)
	c.uuid = uuid
	return c
}

func TestSecondConnectWithSameUUIDSupersedesFirst(t *testing.T) {
	h := NewHub()
	old := withUUID(h, "tab1", "uuid-alice")
	old.handshake()
	bob := testClient(h, "b", "bob", "")
	drain(t, old)
	drain(t, bob)

	fresh := withUUID(h, "tab2", "uuid-alice")
	fresh.handshake()

	// The old tab got session:superseded, then its queue was closed (so its
	// writePump sends the 4001 close) and it's flagged.
	got := drain(t, old)
	if len(got) != 1 || got[0]["type"] != EventSessionSuperseded {
		t.Fatalf("old tab frames = %v, want exactly session:superseded", got)
	}
	if _, ok := <-old.send; ok {
		t.Fatal("old tab's send queue still open")
	}
	if !old.superseded.Load() {
		t.Fatal("old tab not flagged superseded")
	}

	// It's gone from the hub, and the newcomer's roster doesn't include it.
	if _, ok := h.clients["tab1"]; ok {
		t.Fatal("old tab still registered")
	}
	welcome := ofType(drain(t, fresh), EventSessionWelcome)[0]
	users := welcome["users"].(map[string]any)
	if _, ok := users["tab1"]; ok || users["tab2"] == nil || users["b"] == nil {
		t.Fatalf("newcomer roster = %v, want tab2 + b, no tab1", users)
	}
	// The newcomer was not evicted itself.
	if fresh.superseded.Load() || h.clients["tab2"] != fresh {
		t.Fatal("newcomer evicted itself")
	}
	if j := ofType(drain(t, bob), EventUserJoined); len(j) != 1 || j[0]["from"] != "tab2" {
		t.Fatalf("bob got joined %v, want tab2", j)
	}
}

func TestDifferentUUIDDoesNotSupersede(t *testing.T) {
	h := NewHub()
	alice := withUUID(h, "a", "uuid-alice")
	alice.handshake()
	drain(t, alice)

	bob := withUUID(h, "b", "uuid-bob")
	bob.handshake()

	if alice.superseded.Load() || h.clients["a"] == nil || len(h.clients) != 2 {
		t.Fatal("a different uuid evicted alice")
	}
	if s := ofType(drain(t, alice), EventSessionSuperseded); len(s) != 0 {
		t.Fatalf("alice got %v", s)
	}
}

func TestFallbackUUIDsNeverDedup(t *testing.T) {
	h := NewHub()
	// No uuid sent: newClient falls back to the connection id.
	a := &Client{id: "x1", uuid: "x1", send: make(chan []byte, 64), hub: h}
	b := &Client{id: "x2", uuid: "x2", send: make(chan []byte, 64), hub: h}
	a.handshake()
	b.handshake()
	if a.superseded.Load() || len(h.clients) != 2 {
		t.Fatal("fallback uuids deduped")
	}
}

func TestSupersededClientIsIgnored(t *testing.T) {
	h := NewHub()
	old := withUUID(h, "tab1", "uuid-alice")
	old.handshake()
	bob := testClient(h, "b", "bob", "")
	withUUID(h, "tab2", "uuid-alice").handshake()
	drain(t, bob)

	route(old, Message{Type: EventChatMessage, Text: "ghost"})
	route(old, Message{Type: EventUserChangeName, Name: "ghost"})
	if got := drain(t, bob); len(got) != 0 || len(h.chat) != 0 {
		t.Fatalf("superseded client still routed: %v (chat %d)", got, len(h.chat))
	}
}

// End to end over real sockets: the old tab receives session:superseded and
// then a 4001 close; everyone else sees user:left for it and user:joined for
// the new connection.
func TestSupersedeOverRealSockets(t *testing.T) {
	h := NewHub()
	srv := httptest.NewServer(Handler(h))
	defer srv.Close()
	base := "ws" + strings.TrimPrefix(srv.URL, "http")

	dial := func(name, uuid string) (*websocket.Conn, string) {
		t.Helper()
		c, _, err := websocket.DefaultDialer.Dial(base+"/?name="+name+"&uuid="+uuid, nil)
		if err != nil {
			t.Fatal(err)
		}
		m := read(t, c)
		if m.Type != EventSessionWelcome {
			t.Fatalf("first frame %q", m.Type)
		}
		read(t, c) // chat:history
		return c, m.To
	}

	bob, _ := dial("bob", "uuid-bob")
	defer bob.Close()
	tab1, id1 := dial("alice", "uuid-alice")
	defer tab1.Close()
	if m := read(t, bob); m.Type != EventUserJoined || m.From != id1 {
		t.Fatalf("bob: %+v", m)
	}

	tab2, id2 := dial("alice", "uuid-alice")
	defer tab2.Close()

	if m := read(t, tab1); m.Type != EventSessionSuperseded {
		t.Fatalf("tab1 got %q, want session:superseded", m.Type)
	}
	tab1.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, _, err := tab1.ReadMessage()
	var ce *websocket.CloseError
	if !errors.As(err, &ce) || ce.Code != closeSuperseded {
		t.Fatalf("tab1 close = %v, want code %d", err, closeSuperseded)
	}

	seen := map[string]string{}
	for len(seen) < 2 {
		m := read(t, bob)
		seen[m.Type] = m.From
	}
	if seen[EventUserJoined] != id2 || seen[EventUserLeft] != id1 {
		t.Fatalf("bob saw %v, want joined %s + left %s", seen, id2, id1)
	}
	if h.ClientCount() != 2 {
		t.Fatalf("hub has %d clients, want 2 (bob + tab2)", h.ClientCount())
	}
}

func read(t *testing.T, c *websocket.Conn) Message {
	t.Helper()
	c.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, b, err := c.ReadMessage()
	if err != nil {
		t.Fatal(err)
	}
	var m Message
	if err := json.Unmarshal(b, &m); err != nil {
		t.Fatal(err)
	}
	return m
}
