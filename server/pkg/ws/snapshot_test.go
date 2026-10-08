package ws

import "testing"

func TestRenameAndRecolourRewriteAuthorsBufferedMessages(t *testing.T) {
	h := NewHub()
	alice := testClient(h, "a", "alice", "")
	bob := testClient(h, "b", "bob", "")
	route(alice, Message{Type: EventChatMessage, Text: "one"})
	route(bob, Message{Type: EventChatMessage, Text: "bob's"})
	route(alice, Message{Type: EventChatMessage, Text: "two"})

	h.changeName(alice, "alicia")
	h.changeColour(alice, "#22c55e")

	for _, m := range h.chat {
		switch m.AuthorID {
		case "uuid-a":
			if m.Name != "alicia" || m.Colour != "#22c55e" {
				t.Errorf("alice's %q = %s/%s, want alicia/#22c55e", m.Text, m.Name, m.Colour)
			}
		case "uuid-b":
			if m.Name != "bob" || m.Colour != "#ff8800" {
				t.Errorf("bob's message changed: %s/%s", m.Name, m.Colour)
			}
		}
	}

	// A newcomer's history carries the latest name/colour after she leaves.
	h.remove(alice)
	c := newcomer(h, "c", "carol")
	c.handshake()
	msgs := ofType(drain(t, c), EventChatHistory)[0]["messages"].([]any)
	if m := msgs[0].(map[string]any); m["name"] != "alicia" || m["colour"] != "#22c55e" {
		t.Fatalf("history = %v, want alicia/#22c55e", m)
	}
}

func TestRewriteIgnoresFallbackUUID(t *testing.T) {
	h := NewHub()
	// No client uuid: it falls back to the connection id, which never names
	// an author across connections — skip rather than mass-match.
	anon := &Client{id: "x1", uuid: "x1", name: "anon", colour: "#111111", send: make(chan []byte, 64), hub: h}
	h.add(anon)
	route(anon, Message{Type: EventChatMessage, Text: "hi"})
	h.changeName(anon, "renamed")
	if h.chat[0].Name != "anon" {
		t.Fatalf("fallback-uuid message rewritten to %q", h.chat[0].Name)
	}
}
