package web

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/gorilla/mux"
)

const indexHTML = "<!doctype html><title>app</title>"

// router mirrors main.go: real routes first, the SPA as the NotFound handler.
func router() http.Handler {
	fsys := fstest.MapFS{
		"index.html":         {Data: []byte(indexHTML)},
		"assets/app-1a2b.js": {Data: []byte("console.log(1)")},
		"vite.svg":           {Data: []byte("<svg/>")},
	}
	r := mux.NewRouter()
	api := r.PathPrefix("/api").Subrouter()
	api.HandleFunc("/session", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("session"))
	}).Methods(http.MethodGet)
	r.HandleFunc("/ws", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("ws"))
	})
	r.NotFoundHandler = New(fsys)
	return r
}

func do(t *testing.T, method, target string) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	router().ServeHTTP(rec, httptest.NewRequest(method, target, nil))
	return rec
}

func TestRoutesWinOverSPA(t *testing.T) {
	if rec := do(t, "GET", "/api/session"); rec.Body.String() != "session" {
		t.Fatalf("/api/session: got %d %q", rec.Code, rec.Body.String())
	}
	if rec := do(t, "GET", "/ws"); rec.Body.String() != "ws" {
		t.Fatalf("/ws: got %d %q", rec.Code, rec.Body.String())
	}
	// Wrong method on a real route keeps mux's 405, not the SPA.
	if rec := do(t, "PUT", "/api/session"); rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("PUT /api/session: got %d, want 405", rec.Code)
	}
}

func TestUnknownAPIIs404JSON(t *testing.T) {
	for _, p := range []string{"/api", "/api/nope", "/api/session/x"} {
		rec := do(t, "GET", p)
		if rec.Code != http.StatusNotFound || strings.Contains(rec.Body.String(), "<!doctype") {
			t.Fatalf("GET %s: got %d %q, want JSON 404", p, rec.Code, rec.Body.String())
		}
		if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
			t.Fatalf("GET %s: content-type %q", p, ct)
		}
	}
}

func TestSPAFallback(t *testing.T) {
	for _, p := range []string{"/", "/index.html", "/room", "/some/client/route?x=1"} {
		rec := do(t, "GET", p)
		if rec.Code != http.StatusOK || rec.Body.String() != indexHTML {
			t.Fatalf("GET %s: got %d %q, want index.html", p, rec.Code, rec.Body.String())
		}
		if cc := rec.Header().Get("Cache-Control"); cc != "no-store" {
			t.Fatalf("GET %s: Cache-Control %q, want no-store", p, cc)
		}
	}
	if rec := do(t, "HEAD", "/room"); rec.Code != http.StatusOK || rec.Body.Len() != 0 {
		t.Fatalf("HEAD /room: got %d, body %d bytes", rec.Code, rec.Body.Len())
	}
}

func TestStaticFiles(t *testing.T) {
	rec := do(t, "GET", "/assets/app-1a2b.js")
	if rec.Code != http.StatusOK || rec.Body.String() != "console.log(1)" {
		t.Fatalf("asset: got %d %q", rec.Code, rec.Body.String())
	}
	if cc := rec.Header().Get("Cache-Control"); cc != "public, max-age=31536000, immutable" {
		t.Fatalf("asset Cache-Control %q", cc)
	}
	rec = do(t, "GET", "/vite.svg")
	if rec.Code != http.StatusOK || rec.Header().Get("Cache-Control") != "no-cache" {
		t.Fatalf("vite.svg: got %d, Cache-Control %q", rec.Code, rec.Header().Get("Cache-Control"))
	}
	// A stale/missing chunk must not get index.html back as JavaScript.
	if rec := do(t, "GET", "/assets/gone-9z.js"); rec.Code != http.StatusNotFound {
		t.Fatalf("missing asset: got %d, want 404", rec.Code)
	}
}

func TestNonGETUnmatchedIs404(t *testing.T) {
	for _, m := range []string{"POST", "PUT", "DELETE"} {
		if rec := do(t, m, "/room"); rec.Code != http.StatusNotFound {
			t.Fatalf("%s /room: got %d, want 404", m, rec.Code)
		}
	}
}

func TestEmbeddedPlaceholderCompiles(t *testing.T) {
	rec := httptest.NewRecorder()
	Handler().ServeHTTP(rec, httptest.NewRequest("GET", "/", nil))
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "<html") {
		t.Fatalf("embedded index: got %d", rec.Code)
	}
}
