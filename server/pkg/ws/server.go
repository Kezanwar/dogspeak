package ws

import (
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

// Handler returns an http.HandlerFunc that upgrades a request to a WebSocket and
// wires it into the hub.
//
// allowedOrigins gates which sites may open a socket. CORS does NOT apply to
// WebSocket handshakes, so this CheckOrigin is the WS equivalent of the CORS
// allowlist — pass it the same origins, including your frontend. Without it,
// gorilla's default would reject cross-origin connections outright (blocking your
// own frontend); with the naive "return true" any site could hijack a session.
//
// Gate it with auth in main.go:
//
//	r.Handle("/ws", authService.Require(ws.Handler(hub, origins)))
func Handler(hub *Hub, allowedOrigins []string) http.HandlerFunc {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		allowed[o] = struct{}{}
	}

	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			_, ok := allowed[r.Header.Get("Origin")]
			return ok
		},
	}

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
