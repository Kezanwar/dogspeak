package ws

import "encoding/json"

// Event names are the contract shared with the frontend. Keep this list in
// sync with events.md — a mistyped name silently does nothing on one side.
const (
	// Session bootstrap — server -> newcomer only.
	EventSessionWelcome    = "session:welcome"    // full roster snapshot
	EventSessionSuperseded = "session:superseded" // S->evicted: a newer connection with your uuid took over; this one is closing

	// Presence — broadcast server-wide (everyone gets these, whatever channel
	// they're in), so every client can render the full lobby roster.
	EventUserJoined        = "user:joined"         // S->others: someone connected (lands in lobby)
	EventUserLeft          = "user:left"           // S->others: someone disconnected
	EventUserChangeChannel = "user:change_channel" // both ways: someone moved channel ("" = lobby)
	EventUserChangeName    = "user:change_name"    // both ways: someone renamed
	EventUserChangeColour  = "user:change_colour"  // both ways: someone recoloured
	// Self-mute: no payload, the event type IS the state — a `muted: false`
	// couldn't ride the omitempty envelope (the same trap as channel "").
	EventUserMute   = "user:mute"   // both ways: someone muted their mic
	EventUserUnmute = "user:unmute" // both ways: someone unmuted

	// WebRTC signalling — relayed only between peers who share a channel.
	EventPeerOffer     = "peer:offer"
	EventPeerAnswer    = "peer:answer"
	EventPeerCandidate = "peer:candidate"

	// Text chat — ONE global chat, independent of voice channels (lobby included).
	EventChatMessage = "chat:message" // C->S: just text. S->everyone (incl. sender): the stamped message
	EventChatHistory = "chat:history" // S->newcomer, right after session:welcome: the recent messages
)

// ChatMessage is one chat line. AuthorID is the sender's client uuid, so
// clients render name/colour live from whoever has that uuid now; the frozen
// Name/Colour snapshot is the fallback once the author has disconnected.
type ChatMessage struct {
	ID       string `json:"id"`
	From     string `json:"from"`     // sender's connection id at send time
	AuthorID string `json:"authorId"` // sender's client uuid (stable across reloads)
	Name     string `json:"name"`
	Colour   string `json:"colour"`
	Text     string `json:"text"`
	TS       int64  `json:"ts"` // unix millis
}

// UserInfo is one person's public presence. In the welcome roster it's keyed by
// id (the map key), so the id isn't repeated inside the value — mirroring how the
// frontend stores it in an id-keyed observable map.
type UserInfo struct {
	UUID    string `json:"uuid"` // client identity (see Client.uuid); no omitempty
	Name    string `json:"name"`
	Colour  string `json:"colour"`
	Channel string `json:"channel"` // "" = lobby (no channel)
	Muted   bool   `json:"muted"`   // self-muted; no omitempty — false is meaningful
}

// Message is the envelope for everything on the wire.
//
// Most fields are typed and read by the server: Channel/Name/Colour let it keep
// each client's presence up to date. Data is the ONE opaque field — it carries
// the SDP/ICE payload for signalling events, which the server forwards without
// ever looking inside.
type Message struct {
	Type     string              `json:"type"`
	To       string              `json:"to,omitempty"`       // target peer (also your own id on welcome)
	From     string              `json:"from,omitempty"`     // sender id; the server ALWAYS stamps this
	Name     string              `json:"name,omitempty"`     // user:change_name payload
	Colour   string              `json:"colour,omitempty"`   // user:change_colour payload
	Channel  string              `json:"channel,omitempty"`  // user:change_channel payload
	Data     json.RawMessage     `json:"data,omitempty"`     // opaque: SDP / ICE, passed straight through
	Users    map[string]UserInfo `json:"users,omitempty"`    // welcome roster, keyed by id
	UUID     string              `json:"uuid,omitempty"`     // user:joined: the newcomer's client uuid
	AuthorID string              `json:"authorId,omitempty"` // chat:message: author's client uuid
	ID       string              `json:"id,omitempty"`       // chat:message id (server-generated)
	Text     string              `json:"text,omitempty"`     // chat:message text
	TS       int64               `json:"ts,omitempty"`       // chat:message time, unix millis
}

// historyMessage is the chat:history frame. It's its own type (not Message) so
// `messages` is always present, as [] when there's no history yet.
type historyMessage struct {
	Type     string        `json:"type"`
	Messages []ChatMessage `json:"messages"`
}

// chatFrame builds the chat:message broadcast for one stored message. Chat is
// global, so it carries no channel.
func chatFrame(cm ChatMessage) []byte {
	return encode(Message{
		Type: EventChatMessage, ID: cm.ID, From: cm.From, AuthorID: cm.AuthorID,
		Name: cm.Name, Colour: cm.Colour, Text: cm.Text, TS: cm.TS,
	})
}

// encode marshals a message to JSON. Marshalling this fixed struct can't fail,
// so the error is dropped.
func encode(m Message) []byte {
	b, _ := json.Marshal(m)
	return b
}
