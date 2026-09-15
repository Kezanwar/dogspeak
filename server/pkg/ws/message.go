package ws

import "encoding/json"

// Event names are the contract shared with the frontend. Keep this list in
// sync with events.md — a mistyped name silently does nothing on one side.
const (
	// Presence — broadcast server-wide (everyone gets these, whatever channel
	// they're in), so every client can render the full lobby roster.
	EventWelcome       = "welcome"        // S->newcomer only: full roster snapshot
	EventUserJoined    = "user-joined"    // S->others: someone connected (lands in lobby)
	EventUserLeft      = "user-left"      // S->others: someone disconnected
	EventChannelChange = "channel-change" // both ways: someone moved channel ("" = lobby)
	EventNameChange    = "name-change"    // both ways: someone renamed
	EventColorChange   = "color-change"   // both ways: someone recoloured

	// WebRTC signalling — relayed only between peers who share a channel.
	EventOffer     = "offer"
	EventAnswer    = "answer"
	EventCandidate = "candidate"
)

// UserInfo is one person's public presence, as sent in the roster and deltas.
type UserInfo struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Color   string `json:"color"`
	Channel string `json:"channel"` // "" = lobby (no channel)
}

// Message is the envelope for everything on the wire.
//
// Most fields are typed and read by the server: Channel/Name/Color let it keep
// each client's presence up to date. Data is the ONE opaque field — it carries
// the SDP/ICE payload for signalling events, which the server forwards without
// ever looking inside.
type Message struct {
	Type    string          `json:"type"`
	To      string          `json:"to,omitempty"`    // target peer, for relayed signalling
	From    string          `json:"from,omitempty"`  // sender id; the server ALWAYS stamps this
	Name    string          `json:"name,omitempty"`  // name-change payload
	Color   string          `json:"color,omitempty"` // color-change payload
	Channel string          `json:"channel,omitempty"`
	Data    json.RawMessage `json:"data,omitempty"`  // opaque: SDP / ICE, passed straight through
	Users   []UserInfo      `json:"users,omitempty"` // welcome roster only
}

// encode marshals a message to JSON. Marshalling this fixed struct can't fail,
// so the error is dropped.
func encode(m Message) []byte {
	b, _ := json.Marshal(m)
	return b
}
