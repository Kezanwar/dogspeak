package ws

import "encoding/json"

// Event names are the contract shared with the frontend. Keep this list in
// sync with events.md — a mistyped name silently does nothing on one side.
const (
	// Session bootstrap — server -> newcomer only.
	EventSessionWelcome = "session:welcome" // full roster snapshot

	// Presence — broadcast server-wide (everyone gets these, whatever channel
	// they're in), so every client can render the full lobby roster.
	EventUserJoined        = "user:joined"         // S->others: someone connected (lands in lobby)
	EventUserLeft          = "user:left"           // S->others: someone disconnected
	EventUserChangeChannel = "user:change_channel" // both ways: someone moved channel ("" = lobby)
	EventUserChangeName    = "user:change_name"    // both ways: someone renamed
	EventUserChangeColour  = "user:change_colour"  // both ways: someone recoloured

	// WebRTC signalling — relayed only between peers who share a channel.
	EventPeerOffer     = "peer:offer"
	EventPeerAnswer    = "peer:answer"
	EventPeerCandidate = "peer:candidate"
)

// UserInfo is one person's public presence. In the welcome roster it's keyed by
// id (the map key), so the id isn't repeated inside the value — mirroring how the
// frontend stores it in an id-keyed observable map.
type UserInfo struct {
	Name    string `json:"name"`
	Colour  string `json:"colour"`
	Channel string `json:"channel"` // "" = lobby (no channel)
}

// Message is the envelope for everything on the wire.
//
// Most fields are typed and read by the server: Channel/Name/Colour let it keep
// each client's presence up to date. Data is the ONE opaque field — it carries
// the SDP/ICE payload for signalling events, which the server forwards without
// ever looking inside.
type Message struct {
	Type    string              `json:"type"`
	To      string              `json:"to,omitempty"`      // target peer (also your own id on welcome)
	From    string              `json:"from,omitempty"`    // sender id; the server ALWAYS stamps this
	Name    string              `json:"name,omitempty"`    // user:change_name payload
	Colour  string              `json:"colour,omitempty"`  // user:change_colour payload
	Channel string              `json:"channel,omitempty"` // user:change_channel payload
	Data    json.RawMessage     `json:"data,omitempty"`    // opaque: SDP / ICE, passed straight through
	Users   map[string]UserInfo `json:"users,omitempty"`   // welcome roster, keyed by id
}

// encode marshals a message to JSON. Marshalling this fixed struct can't fail,
// so the error is dropped.
func encode(m Message) []byte {
	b, _ := json.Marshal(m)
	return b
}
