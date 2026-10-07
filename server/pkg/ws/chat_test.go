package ws

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"
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

func TestChatIsGlobalBroadcastToEveryoneIncludingSender(t *testing.T) {
	h := NewHub()
	alice := testClient(h, "a", "alice", "general")
	bob := testClient(h, "b", "bob", "general")
	carol := testClient(h, "c", "carol", "lounge") // different voice channel
	dave := testClient(h, "d", "dave", "")         // lobby

	route(alice, Message{Type: EventChatMessage, Text: "  hi all  "})

	for _, c := range []*Client{alice, bob, carol, dave} {
		got := ofType(drain(t, c), EventChatMessage)
		if len(got) != 1 {
			t.Fatalf("%s: got %d chat frames, want 1", c.name, len(got))
		}
		m := got[0]
		if m["text"] != "hi all" || m["from"] != "a" || m["name"] != "alice" ||
			m["colour"] != "#ff8800" || m["id"] == "" || m["ts"] == nil {
			t.Errorf("%s: unexpected frame %v", c.name, m)
		}
		if _, ok := m["channel"]; ok {
			t.Errorf("%s: chat frame should not carry a channel: %v", c.name, m)
		}
	}
}

func TestLobbyClientCanPostAndReceive(t *testing.T) {
	h := NewHub()
	lobby := testClient(h, "a", "alice", "")
	other := testClient(h, "b", "bob", "")

	route(lobby, Message{Type: EventChatMessage, Text: "anyone about?"})

	for _, c := range []*Client{lobby, other} {
		if got := ofType(drain(t, c), EventChatMessage); len(got) != 1 || got[0]["text"] != "anyone about?" {
			t.Fatalf("%s: got %v", c.name, got)
		}
	}
	if len(h.chat) != 1 {
		t.Fatalf("stored %d messages, want 1", len(h.chat))
	}
}

func TestChatEmptyIgnored(t *testing.T) {
	h := NewHub()
	c := testClient(h, "a", "alice", "")
	route(c, Message{Type: EventChatMessage, Text: "   \n\t "})
	if got := drain(t, c); len(got) != 0 || len(h.chat) != 0 {
		t.Errorf("expected nothing, got frames=%v stored=%d", got, len(h.chat))
	}
}

func TestChatLengthCapped(t *testing.T) {
	h := NewHub()
	c := testClient(h, "a", "alice", "")
	route(c, Message{Type: EventChatMessage, Text: strings.Repeat("é", maxChatLen+50)})

	if len(h.chat) != 1 || len([]rune(h.chat[0].Text)) != maxChatLen {
		t.Fatalf("want one message of %d runes, got %d messages", maxChatLen, len(h.chat))
	}
}

// newcomer builds an unregistered client, as the ws handler does before handshake.
func newcomer(h *Hub, id, name string) *Client {
	return &Client{id: id, name: name, colour: "#0088ff", send: make(chan []byte, 64), hub: h}
}

func TestHistoryDeliveredOnConnectRightAfterWelcome(t *testing.T) {
	h := NewHub()
	alice := testClient(h, "a", "alice", "general")
	for i := range chatHistoryLimit + 5 {
		route(alice, Message{Type: EventChatMessage, Text: fmt.Sprintf("msg %d", i)})
	}
	if len(h.chat) != chatHistoryLimit {
		t.Fatalf("buffer holds %d, want %d", len(h.chat), chatHistoryLimit)
	}
	// Sender renames then leaves: the stored snapshot keeps the old name.
	h.changeName(alice, "alicia")
	h.remove(alice)

	bob := newcomer(h, "b", "bob")
	bob.handshake()

	frames := drain(t, bob)
	if len(frames) < 2 || frames[0]["type"] != EventSessionWelcome || frames[1]["type"] != EventChatHistory {
		t.Fatalf("want welcome then history first, got %v", frames)
	}
	hist := frames[1]
	if _, ok := hist["channel"]; ok {
		t.Errorf("history should not carry a channel: %v", hist)
	}
	msgs := hist["messages"].([]any)
	if len(msgs) != chatHistoryLimit {
		t.Fatalf("history has %d messages, want %d", len(msgs), chatHistoryLimit)
	}
	first, last := msgs[0].(map[string]any), msgs[len(msgs)-1].(map[string]any)
	if first["text"] != "msg 5" || last["text"] != fmt.Sprintf("msg %d", chatHistoryLimit+4) {
		t.Errorf("oldest not dropped: first=%v last=%v", first["text"], last["text"])
	}
	if last["name"] != "alice" {
		t.Errorf("name snapshot = %v, want alice", last["name"])
	}
}

func TestHistoryOnConnectEmptyIsArray(t *testing.T) {
	h := NewHub()
	c := newcomer(h, "a", "alice")
	c.handshake()
	hist := ofType(drain(t, c), EventChatHistory)
	if len(hist) != 1 {
		t.Fatalf("got %d history frames, want 1", len(hist))
	}
	if msgs, ok := hist[0]["messages"].([]any); !ok || len(msgs) != 0 {
		t.Errorf("want messages: [], got %v", hist[0]["messages"])
	}
}

func TestJoiningVoiceChannelSendsNoHistory(t *testing.T) {
	h := NewHub()
	c := testClient(h, "a", "alice", "")
	route(c, Message{Type: EventUserChangeChannel, Channel: "lounge"})
	route(c, Message{Type: EventUserChangeChannel, Channel: ""})
	if got := ofType(drain(t, c), EventChatHistory); len(got) != 0 {
		t.Errorf("channel change sent history: %v", got)
	}
}

// A message posted while someone connects must reach them exactly once: either
// inside their history snapshot or as a live frame AFTER it (a live frame that
// arrived before the history would be wiped by it). Run with -race.
func TestConnectAndPostRaceDeliversEachMessageOnce(t *testing.T) {
	for round := range 200 {
		h := NewHub()
		poster := testClient(h, "p", "poster", "")
		joiner := newcomer(h, "j", "joiner")

		var wg sync.WaitGroup
		wg.Add(2)
		go func() { defer wg.Done(); route(poster, Message{Type: EventChatMessage, Text: "racy"}) }()
		go func() { defer wg.Done(); joiner.handshake() }()
		wg.Wait()

		seen, historySeen := 0, false
		for _, f := range drain(t, joiner) {
			switch f["type"] {
			case EventChatHistory:
				historySeen = true
				seen += len(f["messages"].([]any))
			case EventChatMessage:
				if !historySeen {
					t.Fatalf("round %d: live chat frame arrived before history", round)
				}
				seen++
			}
		}
		if seen != 1 {
			t.Fatalf("round %d: joiner saw the message %d times, want 1", round, seen)
		}
	}
}
