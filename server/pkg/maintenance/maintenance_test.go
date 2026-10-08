package maintenance

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestFromEnv(t *testing.T) {
	for v, want := range map[string]bool{
		"true": true, "TRUE": true, " 1 ": true, "1": true,
		"": false, "false": false, "0": false, "yes": false, "on": false,
	} {
		if got := FromEnv(v); got != want {
			t.Errorf("FromEnv(%q) = %v, want %v", v, got, want)
		}
	}
}

func TestGateOffIsPassThrough(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })
	rec := httptest.NewRecorder()
	Gate(false)(ok).ServeHTTP(rec, httptest.NewRequest("GET", "/", nil))
	if rec.Code != http.StatusTeapot {
		t.Fatalf("got %d", rec.Code)
	}
}
