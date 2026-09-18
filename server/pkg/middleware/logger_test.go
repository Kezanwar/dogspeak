package middleware

import (
	"bytes"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// captureLogs swaps in a buffer-backed slog default for the duration of a test.
func captureLogs(t *testing.T) *bytes.Buffer {
	t.Helper()
	var buf bytes.Buffer
	old := slog.Default()
	slog.SetDefault(slog.New(slog.NewTextHandler(&buf, nil)))
	t.Cleanup(func() { slog.SetDefault(old) })
	return &buf
}

func TestLoggerLogsRequest(t *testing.T) {
	buf := captureLogs(t)

	h := Logger(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
	}))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/session", nil))

	if rec.Code != http.StatusCreated {
		t.Fatalf("status should pass through: got %d, want 201", rec.Code)
	}
	out := buf.String()
	if !strings.Contains(out, "path=/session") || !strings.Contains(out, "status=201") {
		t.Errorf("log missing details: %q", out)
	}
}

func TestLoggerSkipsWebSocket(t *testing.T) {
	buf := captureLogs(t)

	ran := false
	h := Logger(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { ran = true }))
	req := httptest.NewRequest(http.MethodGet, "/ws", nil)
	req.Header.Set("Upgrade", "websocket")
	h.ServeHTTP(httptest.NewRecorder(), req)

	if !ran {
		t.Fatal("inner handler should still run for a ws upgrade")
	}
	if buf.Len() != 0 {
		t.Errorf("ws upgrade should not be logged, got %q", buf.String())
	}
}
