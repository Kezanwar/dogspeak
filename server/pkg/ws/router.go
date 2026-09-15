package ws

// route decides what to do with an inbound message based on its Type. It's the
// Go side of the events.md contract and the mirror of the frontend's store.
//
// Two buckets, same as before but now channel-aware:
//   - signalling: relayed to ONE peer, and only if they share the sender's channel
//   - presence:   applied to the sender, then broadcast to EVERYONE (server-wide)
func route(c *Client, m Message) {
	// Always stamp the real sender. Never trust a client-supplied From.
	m.From = c.id

	switch m.Type {

	// Channel-scoped signalling: forward verbatim to the one target peer.
	case EventOffer, EventAnswer, EventCandidate:
		if m.To != "" {
			c.hub.relayToPeer(c, m.To, encode(m))
		}

	// Presence: update the client, then fan the change out to everyone.
	case EventChannelChange:
		c.hub.changeChannel(c, m.Channel)
	case EventNameChange:
		c.hub.changeName(c, m.Name)
	case EventColorChange:
		c.hub.changeColor(c, m.Color)

	default:
		// Unknown event type: ignore. While developing you might log it.
	}
}
