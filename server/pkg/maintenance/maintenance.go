// Package maintenance is the server side of maintenance mode: an env flag
// read once at startup (MAINTENANCE=true|1), an always-200 status endpoint
// the client polls, and a gate that 503s the routes that would start a
// session (login/session, the /ws upgrade).
//
// Not gated, on purpose: GET /api/health (Render's health check — a 503 there
// would make Render restart the service in a loop), GET /api/status, and the
// static SPA, so the page still loads, shows the maintenance screen and polls.
package maintenance

import (
	"net/http"
	"strings"

	"dogspeak-server/pkg/respond"
)

// FromEnv parses the MAINTENANCE value: "true" or "1" (any case, trimmed) is on.
func FromEnv(v string) bool {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "true", "1":
		return true
	}
	return false
}

type status struct {
	Maintenance bool `json:"maintenance"`
}

// Status answers GET /api/status: always 200 {"maintenance": on}. It's the
// client's source of truth — unauthenticated and never gated.
func Status(on bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		respond.JSON(w, http.StatusOK, status{Maintenance: on})
	})
}

// retryAfter hints how soon (seconds) to try again; the client polls
// /api/status on its own cadence anyway.
const retryAfter = "7"

// Gate returns middleware that answers 503 instead of calling next while
// maintenance is on (and is a no-op when it's off). Wrap it OUTSIDE auth so
// a parked client gets 503, not 401.
func Gate(on bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		if !on {
			return next
		}
		return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Retry-After", retryAfter)
			respond.Error(w, http.StatusServiceUnavailable, "maintenance")
		})
	}
}
