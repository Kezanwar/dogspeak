package ws

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

// testClient builds a hub-registered client with no socket; frames it's sent
// pile up in its send channel for the test to read.
func testClient(h *Hub, id, name, channel string) *Client {
	c := &Client{id: id, name: name, colour: "#ff8800", channel: channel, send: make(chan []byte, 64), hub: h}
	h.add(c)
	return c
}

// drain returns every frame queued for c, decoded loosely.
func drain(t *testing.T, c *Client) []map[string]any {
	t.Helper()
	var out []map[string]any
	for {
		select {
		case b := <-c.send:
			var m map[string]any
			if err := json.Unmarshal(b, &m); err != nil {
				t.Fatalf("bad frame %s: %v", b, err)
			}
			out = append(out, m)
		default:
			return out
		}
	}
}

func ofType(frames []map[string]any, typ string) []map[string]any {
	var out []map[string]any
	for _, f := range frames {
		if f["type"] == typ {
			out = append(out, f)
		}
	}
	return out
}

func TestChatBroadcastsToChannelIncludingSender(t *testing.T) {
	h := NewHub()
	alice := testClient(h, "a", "alice", "general")
	bob := testClient(h, "b", "bob", "general")
	carol := testClient(h, "c", "carol", "lounge")
	dave := testClient(h, "d", "dave", "")

	route(alice, Message{Type: EventChatMessage, Text: "  hi all  "})

	for _, c := range []*Client{alice, bob} {
		got := ofType(drain(t, c), EventChatMessage)
		if len(got) != 1 {
			t.Fatalf("%s: got %d chat frames, want 1", c.name, len(got))
		}
		m := got[0]
		if m["text"] != "hi all" || m["from"] != "a" || m["name"] != "alice" ||
			m["colour"] != "#ff8800" || m["channel"] != "general" || m["id"] == "" || m["ts"] == nil {
			t.Errorf("%s: unexpected frame %v", c.name, m)
		}
	}
	for _, c := range []*Client{carol, dave} {
		if got := drain(t, c); len(got) != 0 {
			t.Errorf("%s (other channel/lobby) got %v", c.name, got)
		}
	}
}

func TestChatIgnoredInLobbyAndWhenEmpty(t *testing.T) {
	h := NewHub()
	lobby := testClient(h, "a", "alice", "")
	inGeneral := testClient(h, "b", "bob", "general")

	route(lobby, Message{Type: EventChatMessage, Text: "hello?"})
	route(inGeneral, Message{Type: EventChatMessage, Text: "   \n\t "})

	if got := drain(t, inGeneral); len(got) != 0 {
		t.Errorf("expected nothing, got %v", got)
	}
	if n := len(h.chat["general"]) + len(h.chat[""]); n != 0 {
		t.Errorf("stored %d messages, want 0", n)
	}
}

func TestChatLengthCapped(t *testing.T) {
	h := NewHub()
	c := testClient(h, "a", "alice", "general")
	route(c, Message{Type: EventChatMessage, Text: strings.Repeat("é", maxChatLen+50)})

	got := h.chat["general"]
	if len(got) != 1 || len([]rune(got[0].Text)) != maxChatLen {
		t.Fatalf("want one message of %d runes, got %v", maxChatLen, len(got))
	}
}

func TestChatHistoryRingBufferAndJoin(t *testing.T) {
	h := NewHub()
	alice := testClient(h, "a", "alice", "general")
	for i := range chatHistoryLimit + 5 {
		route(alice, Message{Type: EventChatMessage, Text: fmt.Sprintf("msg %d", i)})
	}
	if n := len(h.chat["general"]); n != chatHistoryLimit {
		t.Fatalf("buffer holds %d, want %d", n, chatHistoryLimit)
	}

	// Sender renames then leaves: the stored snapshot keeps the old name.
	h.changeName(alice, "alicia")
	h.remove(alice)

	bob := testClient(h, "b", "bob", "")
	drain(t, bob)
	route(bob, Message{Type: EventUserChangeChannel, Channel: "general"})

	hist := ofType(drain(t, bob), EventChatHistory)
	if len(hist) != 1 {
		t.Fatalf("got %d history frames, want 1", len(hist))
	}
	msgs := hist[0]["messages"].([]any)
	if len(msgs) != chatHistoryLimit || hist[0]["channel"] != "general" {
		t.Fatalf("history has %d messages for %v", len(msgs), hist[0]["channel"])
	}
	first, last := msgs[0].(map[string]any), msgs[len(msgs)-1].(map[string]any)
	if first["text"] != "msg 5" || last["text"] != fmt.Sprintf("msg %d", chatHistoryLimit+4) {
		t.Errorf("oldest not dropped: first=%v last=%v", first["text"], last["text"])
	}
	if last["name"] != "alice" {
		t.Errorf("name snapshot = %v, want alice", last["name"])
	}
}

func TestChatHistoryEmptyAndNotForLobby(t *testing.T) {
	h := NewHub()
	c := testClient(h, "a", "alice", "")

	route(c, Message{Type: EventUserChangeChannel, Channel: "lounge"})
	hist := ofType(drain(t, c), EventChatHistory)
	if len(hist) != 1 {
		t.Fatalf("got %d history frames, want 1", len(hist))
	}
	if msgs, ok := hist[0]["messages"].([]any); !ok || len(msgs) != 0 {
		t.Errorf("want messages: [], got %v", hist[0]["messages"])
	}

	route(c, Message{Type: EventUserChangeChannel, Channel: ""})
	if got := ofType(drain(t, c), EventChatHistory); len(got) != 0 {
		t.Errorf("lobby join sent history: %v", got)
	}
}
