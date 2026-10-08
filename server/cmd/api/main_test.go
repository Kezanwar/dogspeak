package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"

	"dogspeak-server/pkg/auth"
	"dogspeak-server/pkg/ws"
)

func testAuth() *auth.Auth {
	return auth.New(auth.Config{Password: "woof", Secret: []byte("test-secret"), TTL: time.Hour})
}

// login against a normal (maintenance off) router and return the cookie.
func login(t *testing.T, a *auth.Auth) *http.Cookie {
	t.Helper()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/api/session", strings.NewReader(`{"password":"woof"}`))
	req.Header.Set("Content-Type", "application/json")
	routes(a, ws.NewHub(), false).ServeHTTP(rec, req)
	for _, c := range rec.Result().Cookies() {
		if c.Name == "session" {
			return c
		}
	}
	t.Fatalf("login failed: %d %s", rec.Code, rec.Body)
	return nil
}

func status(t *testing.T, h http.Handler, method, path string, cookie *http.Cookie) (int, string) {
	t.Helper()
	req := httptest.NewRequest(method, path, nil)
	if cookie != nil {
		req.AddCookie(cookie)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec.Code, rec.Body.String()
}

func TestMaintenanceOn(t *testing.T) {
	a := testAuth()
	cookie := login(t, a) // a valid session from before maintenance
	h := routes(a, ws.NewHub(), true)

	// Refused: the socket (even with a valid cookie — 503, not 401) and every
	// session route, so no new logins or connections.
	for _, c := range []struct{ method, path string }{
		{"GET", "/ws"}, {"POST", "/api/session"}, {"GET", "/api/session"}, {"DELETE", "/api/session"},
	} {
		if code, _ := status(t, h, c.method, c.path, cookie); code != http.StatusServiceUnavailable {
			t.Errorf("%s %s = %d, want 503", c.method, c.path, code)
		}
	}

	// Still served: health (Render's check must never 503), status, the SPA.
	if code, _ := status(t, h, "GET", "/api/health", nil); code != http.StatusOK {
		t.Errorf("/api/health = %d, want 200", code)
	}
	code, body := status(t, h, "GET", "/api/status", nil)
	var s struct{ Maintenance bool }
	if code != http.StatusOK || json.Unmarshal([]byte(body), &s) != nil || !s.Maintenance {
		t.Errorf("/api/status = %d %s, want 200 {maintenance:true}", code, body)
	}
	if code, body := status(t, h, "GET", "/some/route", nil); code != http.StatusOK || !strings.Contains(body, "<html") {
		t.Errorf("SPA = %d, want 200 index.html", code)
	}
}

func TestMaintenanceOffIsNormal(t *testing.T) {
	a := testAuth()
	cookie := login(t, a)
	h := routes(a, ws.NewHub(), false)

	code, body := status(t, h, "GET", "/api/status", nil)
	if code != http.StatusOK || !strings.Contains(body, `"maintenance":false`) {
		t.Errorf("/api/status = %d %s", code, body)
	}
	if code, _ := status(t, h, "GET", "/api/session", cookie); code != http.StatusOK {
		t.Errorf("GET /api/session with cookie = %d, want 200", code)
	}
	if code, _ := status(t, h, "GET", "/ws", nil); code != http.StatusUnauthorized {
		t.Errorf("/ws without cookie = %d, want 401 (auth, not maintenance)", code)
	}

	// A real upgrade works when off.
	srv := httptest.NewServer(h)
	defer srv.Close()
	hdr := http.Header{"Cookie": {cookie.String()}}
	conn, _, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(srv.URL, "http")+"/ws?name=a&uuid=u1", hdr)
	if err != nil {
		t.Fatalf("ws dial with maintenance off: %v", err)
	}
	conn.Close()
}

func TestMaintenanceRefusesRealUpgrade(t *testing.T) {
	a := testAuth()
	cookie := login(t, a)
	srv := httptest.NewServer(routes(a, ws.NewHub(), true))
	defer srv.Close()
	hdr := http.Header{"Cookie": {cookie.String()}}
	_, resp, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(srv.URL, "http")+"/ws?name=a&uuid=u1", hdr)
	if err == nil || resp == nil || resp.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("upgrade during maintenance: err=%v resp=%v, want 503", err, resp)
	}
}
