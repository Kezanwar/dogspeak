package auth

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func testAuth() *Auth {
	return New(Config{
		Password: "hunter2",
		Secret:   []byte("test-secret-value-not-for-prod"),
		TTL:      time.Hour,
	})
}

// sessionCookie finds the "session" cookie in a response, or nil.
func sessionCookie(resp *http.Response) *http.Cookie {
	for _, c := range resp.Cookies() {
		if c.Name == cookieName {
			return c
		}
	}
	return nil
}

func TestLoginWrongPassword(t *testing.T) {
	a := testAuth()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/session", strings.NewReader(`{"password":"nope"}`))

	a.Login(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("wrong password: got %d, want 401", rec.Code)
	}
	if sessionCookie(rec.Result()) != nil {
		t.Fatal("wrong password should not set a session cookie")
	}
}

func TestLoginRightPasswordSetsCookie(t *testing.T) {
	a := testAuth()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/session", strings.NewReader(`{"password":"hunter2"}`))

	a.Login(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("right password: got %d, want 204", rec.Code)
	}
	c := sessionCookie(rec.Result())
	if c == nil {
		t.Fatal("right password should set a session cookie")
	}
	if !c.HttpOnly {
		t.Error("session cookie must be HttpOnly")
	}
	if c.Value == "" {
		t.Error("session cookie should carry a token")
	}
}

// Full happy path: log in, then use the returned cookie to pass a session check.
func TestSessionAcceptsIssuedCookie(t *testing.T) {
	a := testAuth()

	loginRec := httptest.NewRecorder()
	a.Login(loginRec, httptest.NewRequest(http.MethodPost, "/session", strings.NewReader(`{"password":"hunter2"}`)))
	cookie := sessionCookie(loginRec.Result())
	if cookie == nil {
		t.Fatal("login did not set a cookie")
	}

	sessRec := httptest.NewRecorder()
	sessReq := httptest.NewRequest(http.MethodGet, "/session", nil)
	sessReq.AddCookie(cookie)
	a.Session(sessRec, sessReq)

	if sessRec.Code != http.StatusNoContent {
		t.Fatalf("valid cookie: got %d, want 204", sessRec.Code)
	}
	// Sliding session should re-issue a fresh cookie.
	if sessionCookie(sessRec.Result()) == nil {
		t.Error("session check should slide (re-issue) the cookie")
	}
}

func TestSessionRejectsNoCookie(t *testing.T) {
	a := testAuth()
	rec := httptest.NewRecorder()
	a.Session(rec, httptest.NewRequest(http.MethodGet, "/session", nil))

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("no cookie: got %d, want 401", rec.Code)
	}
}

func TestSessionRejectsForeignToken(t *testing.T) {
	a := testAuth()
	// A token signed by a DIFFERENT secret must be rejected.
	other := New(Config{Password: "x", Secret: []byte("a-totally-different-secret"), TTL: time.Hour})
	forged, _ := other.mint()

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/session", nil)
	req.AddCookie(&http.Cookie{Name: cookieName, Value: forged})
	a.Session(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("foreign token: got %d, want 401", rec.Code)
	}
}

func TestExpiredTokenRejected(t *testing.T) {
	a := New(Config{Password: "hunter2", Secret: []byte("secret"), TTL: -time.Hour}) // already expired
	tok, _ := a.mint()
	if a.valid(tok) {
		t.Fatal("expired token should not be valid")
	}
}

func TestRequireGate(t *testing.T) {
	a := testAuth()
	reached := false
	guarded := a.Require(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reached = true
		w.WriteHeader(http.StatusOK)
	}))

	// Without a cookie: blocked.
	rec := httptest.NewRecorder()
	guarded.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/ws", nil))
	if rec.Code != http.StatusUnauthorized || reached {
		t.Fatalf("no cookie should be blocked: code=%d reached=%v", rec.Code, reached)
	}

	// With a valid cookie: passes through.
	tok, _ := a.mint()
	rec2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodGet, "/ws", nil)
	req2.AddCookie(&http.Cookie{Name: cookieName, Value: tok})
	guarded.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusOK || !reached {
		t.Fatalf("valid cookie should pass: code=%d reached=%v", rec2.Code, reached)
	}
}

func TestLogoutClearsCookie(t *testing.T) {
	a := testAuth()
	rec := httptest.NewRecorder()
	a.Logout(rec, httptest.NewRequest(http.MethodDelete, "/session", nil))

	c := sessionCookie(rec.Result())
	if c == nil {
		t.Fatal("logout should send a cookie to overwrite the old one")
	}
	if c.MaxAge >= 0 {
		t.Errorf("logout cookie MaxAge should be negative (delete), got %d", c.MaxAge)
	}
}
