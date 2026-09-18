package middleware

import (
	"bufio"
	"log/slog"
	"net"
	"net/http"
	"time"
)

// statusRecorder wraps a ResponseWriter to capture the status code for logging.
type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(code int) {
	r.status = code
	r.ResponseWriter.WriteHeader(code)
}

// Hijack forwards to the underlying writer so a wrapped handler can still
// upgrade to a WebSocket — gorilla's Upgrade needs http.Hijacker, and a naive
// wrapper would hide it and break the upgrade.
func (r *statusRecorder) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	h, ok := r.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, http.ErrNotSupported
	}
	return h.Hijack()
}

// Logger logs each HTTP request: method, path, status, duration. WebSocket
// upgrades are skipped here — they're long-lived, so the ws package logs their
// connect/disconnect lifecycle instead (a request log would only fire at
// disconnect, with a misleading whole-session duration).
func Logger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Upgrade") == "websocket" {
			next.ServeHTTP(w, r)
			return
		}

		start := time.Now()
		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rec, r)

		slog.Info("http request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", rec.status,
			"ms", time.Since(start).Milliseconds(),
		)
	})
}
