package ws

import (
	"log/slog"
	"net/http"
	"net/url"
	"strings"

	"github.com/gorilla/websocket"
)

// Handler returns an http.HandlerFunc that upgrades a request to a WebSocket and
// wires it into the hub.
//
// Only same-origin handshakes are accepted: the browser's Origin host must
// equal the request's Host. Everything is same-origin now — in prod Go serves
// the SPA itself, and in dev the Vite proxy forwards /ws without rewriting
// Host — so no allowlist is needed. CORS doesn't apply to WebSocket
// handshakes, so this check is what stops another site opening a socket with
// a logged-in user's cookie.
//
// Gate it with auth in main.go:
//
//	r.Handle("/ws", authService.Require(ws.Handler(hub)))
func Handler(hub *Hub) http.HandlerFunc {
	upgrader := websocket.Upgrader{CheckOrigin: sameOrigin}

	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			slog.Error("ws upgrade failed", "err", err)
			return
		}

		name := r.URL.Query().Get("name")
		colour := r.URL.Query().Get("colour")
		uuid := r.URL.Query().Get("uuid") // client identity, see Client.uuid

		c := newClient(hub, conn, name, colour, uuid)
		slog.Info("ws connected", "id", c.id, "remote", r.RemoteAddr)
		go c.writePump()
		c.readPump() // blocks on this goroutine until the client disconnects
	}
}

// sameOrigin reports whether the handshake's Origin host matches its Host.
// No Origin header means a non-browser client (no ambient-cookie risk from
// another site), which gorilla also allows by default.
func sameOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true
	}
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	return strings.EqualFold(u.Host, r.Host)
}
