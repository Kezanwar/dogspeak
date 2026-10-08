package ws

import (
	"strings"
	"unicode/utf8"
)

// maxChatLen caps a chat message, in characters (runes) after trimming.
const maxChatLen = 2000

// route decides what to do with an inbound message based on its Type. It's the
// Go side of the events.md contract and the mirror of the frontend's store.
//
// Two buckets:
//   - signalling: relayed to ONE peer, and only if they share the sender's channel
//   - presence:   applied to the sender, then broadcast to EVERYONE (server-wide)
//   - chat:       stamped + stored, then sent to EVERYONE (global, not per channel)
func route(c *Client, m Message) {
	// An evicted (superseded) connection is on its way out: ignore anything
	// it still sends so it can't post, signal or change presence as a ghost.
	if c.superseded.Load() {
		return
	}

	// Always stamp the real sender. Never trust a client-supplied From.
	m.From = c.id

	switch m.Type {

	// Channel-scoped signalling: forward verbatim to the one target peer.
	case EventPeerOffer, EventPeerAnswer, EventPeerCandidate:
		if m.To != "" {
			c.hub.relayToPeer(c, m.To, encode(m))
		}

	// Presence: update the client, then fan the change out to everyone.
	case EventUserChangeChannel:
		c.hub.changeChannel(c, m.Channel)
	case EventUserChangeName:
		c.hub.changeName(c, m.Name)
	case EventUserChangeColour:
		c.hub.changeColour(c, m.Colour)
	case EventUserMute:
		c.hub.setMuted(c, true)
	case EventUserUnmute:
		c.hub.setMuted(c, false)

	// Chat: global, sender included. Empty messages are dropped.
	case EventChatMessage:
		if text := cleanChat(m.Text); text != "" {
			c.hub.postChat(c, text)
		}

	default:
		// Unknown event type: ignore. While developing you might log it.
	}
}

// cleanChat trims whitespace and caps the length at maxChatLen runes (never
// splitting a multi-byte character). Returns "" for an empty message.
func cleanChat(text string) string {
	text = strings.TrimSpace(text)
	if utf8.RuneCountInString(text) > maxChatLen {
		text = strings.TrimSpace(string([]rune(text)[:maxChatLen]))
	}
	return text
}
