package auth

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"dogspeak-server/pkg/respond"
)

// loginRequest is the JSON body of POST /session.
type loginRequest struct {
	Password string `json:"password"`
}

// Login handles POST /session: check the password and, on success, set the
// session cookie. This is the only place the password is ever used.
func (a *Auth) Login(w http.ResponseWriter, r *http.Request) {
	var body loginRequest
	// Cap the body so a huge payload can't be read into memory.
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024)).Decode(&body); err != nil {
		respond.Error(w, http.StatusBadRequest, "bad request")
		return
	}

	if !a.checkPassword(body.Password) {
		slog.Warn("login failed", "remote", r.RemoteAddr)
		respond.Error(w, http.StatusUnauthorized, "incorrect password")
		return
	}

	token, err := a.mint()
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "internal error")
		return
	}
	a.setCookie(w, token)
	slog.Info("login ok", "remote", r.RemoteAddr)
	w.WriteHeader(http.StatusNoContent)
}

// Session handles GET /session: verify the cookie and, if good, slide the expiry
// forward (re-issue) so active users rarely have to re-enter the password.
// 204 => you're logged in; 401 => show the password screen.
func (a *Auth) Session(w http.ResponseWriter, r *http.Request) {
	token := cookieToken(r)
	if token == "" || !a.valid(token) {
		a.clearCookie(w) // bin any stale cookie so the browser stops sending it
		respond.Error(w, http.StatusUnauthorized, "not authenticated")
		return
	}

	// Sliding session: re-issue on every successful check.
	if fresh, err := a.mint(); err == nil {
		a.setCookie(w, fresh)
	}
	respond.JSON(w, http.StatusOK, map[string]bool{"ok": true})
}

// Logout handles DELETE /session: delete the cookie.
func (a *Auth) Logout(w http.ResponseWriter, r *http.Request) {
	a.clearCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

// Require wraps a handler so it only runs for requests carrying a valid session
// cookie. It gates the WebSocket upgrade from the outside, so the ws package
// never needs to know auth exists.
func (a *Auth) Require(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := cookieToken(r)
		if token == "" || !a.valid(token) {
			respond.Error(w, http.StatusUnauthorized, "not authenticated")
			return
		}
		next.ServeHTTP(w, r)
	})
}
