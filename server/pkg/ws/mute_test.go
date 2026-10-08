package ws

import (
	"encoding/json"
	"testing"
)

func TestMuteBroadcastsToOthersAndUpdatesState(t *testing.T) {
	h := NewHub()
	alice := testClient(h, "a", "alice", "general")
	bob := testClient(h, "b", "bob", "lounge") // presence is server-wide

	route(alice, Message{Type: EventUserMute})
	if !alice.muted {
		t.Fatal("alice should be muted")
	}
	if got := ofType(drain(t, bob), EventUserMute); len(got) != 1 || got[0]["from"] != "a" {
		t.Fatalf("bob got %v, want one user:mute from a", got)
	}
	if got := drain(t, alice); len(got) != 0 {
		t.Errorf("sender should not get its own mute echoed, got %v", got)
	}

	route(alice, Message{Type: EventUserUnmute})
	if alice.muted {
		t.Fatal("alice should be unmuted")
	}
	if got := ofType(drain(t, bob), EventUserUnmute); len(got) != 1 {
		t.Fatalf("bob got %v, want one user:unmute", got)
	}
}

func TestRosterIncludesMutedWithoutOmitempty(t *testing.T) {
	h := NewHub()
	alice := testClient(h, "a", "alice", "general")
	route(alice, Message{Type: EventUserMute})

	roster := h.add(&Client{id: "c", name: "carol", send: make(chan []byte, 8), hub: h})
	if !roster["a"].Muted || roster["c"].Muted {
		t.Fatalf("roster muted flags wrong: %+v", roster)
	}

	// false must still be on the wire for unmuted users.
	b, _ := json.Marshal(Message{Type: EventSessionWelcome, To: "c", Users: roster})
	var m struct {
		Users map[string]map[string]any `json:"users"`
	}
	if err := json.Unmarshal(b, &m); err != nil {
		t.Fatal(err)
	}
	if v, ok := m.Users["c"]["muted"]; !ok || v != false {
		t.Errorf("carol's muted should be an explicit false, got %v (present=%v)", v, ok)
	}
	if m.Users["a"]["muted"] != true {
		t.Errorf("alice's muted should be true, got %v", m.Users["a"]["muted"])
	}
}
