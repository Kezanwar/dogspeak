package ws

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	// Fine for a hobby project. Lock this down to your real origin before shipping.
	CheckOrigin: func(r *http.Request) bool { return true },
}

// Handler returns an http.HandlerFunc that upgrades a request to a WebSocket and
// wires it into the hub. Mount it on your router — gated by auth in main.go:
//
//	r.Handle("/ws", authService.Require(ws.Handler(hub)))
//
// By the time this runs, auth has already verified the session cookie. The
// client connects with an optional ?name= and ?color= and lands in the lobby
// (no channel); it joins a channel afterwards via a channel-change event.
func Handler(hub *Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println("ws upgrade:", err)
			return
		}

		name := r.URL.Query().Get("name")
		color := r.URL.Query().Get("color")

		c := newClient(hub, conn, name, color)
		go c.writePump()
		c.readPump() // blocks on this goroutine until the client disconnects
	}
}
