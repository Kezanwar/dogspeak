package main

import (
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/lmittmann/tint"
	"github.com/mattn/go-isatty"

	"dogspeak-server/pkg/auth"
	"dogspeak-server/pkg/middleware"
	"dogspeak-server/pkg/web"
	"dogspeak-server/pkg/ws"
)

func main() {
	setupLogger()

	a := auth.New(auth.Config{
		Password:     mustEnv("ROOM_PASSWORD"),
		Secret:       []byte(mustEnv("SESSION_SECRET")),
		CookieDomain: os.Getenv("COOKIE_DOMAIN"), // "" for localhost dev
		CookieSecure: cookieSecure(),             // false for http://localhost
		TTL:          7 * 24 * time.Hour,
	})

	hub := ws.NewHub()

	r := mux.NewRouter()

	api := r.PathPrefix("/api").Subrouter()

	api.HandleFunc("/session", a.Login).Methods(http.MethodPost)
	api.HandleFunc("/session", a.Session).Methods(http.MethodGet)
	api.HandleFunc("/session", a.Logout).Methods(http.MethodDelete)

	r.Handle("/ws", a.Require(ws.Handler(hub)))

	// Everything else is the built SPA (embedded). As the NotFound handler it
	// only runs when no route above matched, so /api and /ws always win (and
	// a wrong method on a real route still gets mux's 405). Single origin
	// everywhere — Go serves the app in prod, Vite proxies to us in dev — so
	// there's no CORS.
	r.NotFoundHandler = web.Handler()

	handler := middleware.Logger(r)

	addr := ":" + port()
	slog.Info("dogspeak server starting", "addr", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		slog.Error("server stopped", "err", err)
		os.Exit(1)
	}
}

// setupLogger configures the global slog logger from env: LOG_LEVEL
// (debug|info|warn|error, default info) and LOG_FORMAT (text|json, default text).
// Text is tint's dev format: dimmed timestamp first, level coloured, and plain
// (no ANSI) when stdout isn't a terminal. JSON is untouched for prod.
func setupLogger() {
	level := slog.LevelInfo
	switch strings.ToLower(os.Getenv("LOG_LEVEL")) {
	case "debug":
		level = slog.LevelDebug
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	}

	var h slog.Handler
	if strings.ToLower(os.Getenv("LOG_FORMAT")) == "json" {
		h = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})
	} else {
		fd := os.Stdout.Fd()
		h = tint.NewHandler(os.Stdout, &tint.Options{
			Level:       level,
			TimeFormat:  time.DateTime,
			NoColor:     !isatty.IsTerminal(fd) && !isatty.IsCygwinTerminal(fd),
			ReplaceAttr: colourDebugLevel,
		})
	}
	slog.SetDefault(slog.New(h))
}

// colourDebugLevel gives DBG its own colour (bright cyan); tint leaves it
// uncoloured by default, and INF/WRN/ERR are already green/yellow/red.
func colourDebugLevel(groups []string, a slog.Attr) slog.Attr {
	if len(groups) == 0 && a.Key == slog.LevelKey {
		if lvl, ok := a.Value.Any().(slog.Level); ok && lvl < slog.LevelInfo {
			return tint.Attr(14, a)
		}
	}
	return a
}

// mustEnv returns the env var or exits — secrets must be set, never defaulted.
func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		slog.Error("missing required env var", "key", key)
		os.Exit(1)
	}
	return v
}

// port reads PORT from the environment, falling back to 8080 for local dev.
func port() string {
	if p := os.Getenv("PORT"); p != "" {
		return p
	}
	return "8080"
}

// cookieSecure: Secure session cookie over HTTPS (prod), off for
// http://localhost dev, where a Secure cookie wouldn't be set at all.
// COOKIE_SECURE=true or ENV=production turns it on.
func cookieSecure() bool {
	return os.Getenv("COOKIE_SECURE") == "true" || os.Getenv("ENV") == "production"
}
