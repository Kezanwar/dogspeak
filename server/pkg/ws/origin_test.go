package ws

import (
	"net/http/httptest"
	"testing"
)

func TestSameOrigin(t *testing.T) {
	cases := []struct {
		host, origin string
		want         bool
	}{
		{"localhost:5173", "http://localhost:5173", true}, // dev, via the Vite proxy
		{"dogspeak.onrender.com", "https://dogspeak.onrender.com", true},
		{"dogspeak.onrender.com", "https://DogSpeak.onrender.com", true},
		{"localhost:8080", "", true}, // non-browser client: no ambient cookie risk
		{"dogspeak.onrender.com", "https://evil.example", false},
		{"localhost:8080", "http://localhost:5173", false}, // port matters
		{"dogspeak.onrender.com", "://bad", false},
	}
	for _, c := range cases {
		r := httptest.NewRequest("GET", "/ws", nil)
		r.Host = c.host
		if c.origin != "" {
			r.Header.Set("Origin", c.origin)
		}
		if got := sameOrigin(r); got != c.want {
			t.Errorf("host %q origin %q: got %v, want %v", c.host, c.origin, got, c.want)
		}
	}
}
