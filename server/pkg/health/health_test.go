package health

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/mux"

	"dogspeak-server/pkg/auth"
)

// Mirrors main.go: /api/health sits on the /api subrouter next to the
// auth-gated /ws, but is NOT behind auth.Require.
func router() http.Handler {
	a := auth.New(auth.Config{Password: "pw", Secret: []byte("secret"), TTL: time.Hour})
	r := mux.NewRouter()
	api := r.PathPrefix("/api").Subrouter()
	api.Handle("/health", Handler(func() int { return 3 })).Methods(http.MethodGet)
	r.Handle("/ws", a.Require(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {})))
	return r
}

func TestHealthOKWithoutAuth(t *testing.T) {
	rec := httptest.NewRecorder()
	router().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/health", nil)) // no cookie
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d, want 200", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("content-type %q", ct)
	}
	var got body
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got != (body{Status: "ok", Clients: 3}) {
		t.Fatalf("body %+v", got)
	}

	// Sanity: the same unauthenticated request IS rejected on the gated route.
	rec = httptest.NewRecorder()
	router().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/ws", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("/ws without cookie: %d, want 401", rec.Code)
	}
}
