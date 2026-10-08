package ws

import (
	"strings"
	"testing"
)

func TestChatMessageCarriesAuthorUUID(t *testing.T) {
	h := NewHub()
	alice := testClient(h, "a", "alice", "")
	bob := testClient(h, "b", "bob", "")

	route(alice, Message{Type: EventChatMessage, Text: "hi"})

	got := ofType(drain(t, bob), EventChatMessage)
	if len(got) != 1 || got[0]["authorId"] != "uuid-a" || got[0]["from"] != "a" {
		t.Fatalf("want authorId uuid-a from a, got %v", got)
	}
	if h.chat[0].AuthorID != "uuid-a" {
		t.Errorf("stored authorId = %q, want uuid-a", h.chat[0].AuthorID)
	}
}

func TestHistoryMessagesCarryAuthorUUID(t *testing.T) {
	h := NewHub()
	alice := testClient(h, "a", "alice", "")
	route(alice, Message{Type: EventChatMessage, Text: "earlier"})
	h.remove(alice) // author gone: the snapshot + authorId remain

	bob := newcomer(h, "b", "bob")
	bob.handshake()
	hist := ofType(drain(t, bob), EventChatHistory)
	msgs := hist[0]["messages"].([]any)
	m := msgs[0].(map[string]any)
	if m["authorId"] != "uuid-a" || m["name"] != "alice" {
		t.Fatalf("history message = %v, want authorId uuid-a with name snapshot", m)
	}
}

func TestRosterAndJoinedCarryUUID(t *testing.T) {
	h := NewHub()
	alice := testClient(h, "a", "alice", "general")

	bob := newcomer(h, "b", "bob")
	bob.handshake()

	welcome := ofType(drain(t, bob), EventSessionWelcome)[0]
	users := welcome["users"].(map[string]any)
	if users["a"].(map[string]any)["uuid"] != "uuid-a" || users["b"].(map[string]any)["uuid"] != "uuid-b" {
		t.Fatalf("roster uuids wrong: %v", users)
	}

	joined := ofType(drain(t, alice), EventUserJoined)
	if len(joined) != 1 || joined[0]["uuid"] != "uuid-b" || joined[0]["from"] != "b" {
		t.Fatalf("user:joined = %v, want uuid uuid-b from b", joined)
	}
}

func TestMissingOrOversizedUUIDFallsBackToConnectionID(t *testing.T) {
	h := NewHub()
	for _, in := range []string{"", strings.Repeat("x", maxUUIDLen+1)} {
		c := newClient(h, nil, "alice", "#ff8800", in)
		if c.uuid != c.id || c.uuid == "" {
			t.Errorf("uuid %q: got %q, want fallback to id %q", in, c.uuid, c.id)
		}
	}
	c := newClient(h, nil, "alice", "#ff8800", "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d")
	if c.uuid != "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d" {
		t.Errorf("valid uuid not kept: %q", c.uuid)
	}
}
