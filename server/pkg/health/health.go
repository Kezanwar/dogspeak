// Package health serves the liveness endpoint (GET /api/health).
package health

import (
	"net/http"

	"dogspeak-server/pkg/respond"
)

type body struct {
	Status  string `json:"status"`
	Clients int    `json:"clients"`
}

// Handler answers 200 {"status":"ok","clients":N}. It must stay cheap and
// unauthenticated: health checkers send no cookie, and nothing here blocks.
// clients is a quick read of the hub's connected-socket count.
func Handler(clients func() int) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		respond.JSON(w, http.StatusOK, body{Status: "ok", Clients: clients()})
	})
}
