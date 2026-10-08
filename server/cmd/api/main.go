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
	"dogspeak-server/pkg/health"
	"dogspeak-server/pkg/maintenance"
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

	maint := maintenance.FromEnv(os.Getenv("MAINTENANCE"))
	if maint {
		slog.Warn("MAINTENANCE mode is ON: /ws and session routes answer 503")
	}

	handler := middleware.Logger(routes(a, hub, maint))

	addr := ":" + port()
	slog.Info("dogspeak server starting", "addr", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		slog.Error("server stopped", "err", err)
		os.Exit(1)
	}
}

// routes wires every endpoint. Split out of main so tests can drive the real
// router (e.g. with maintenance on).
func routes(a *auth.Auth, hub *ws.Hub, maint bool) http.Handler {
	gate := maintenance.Gate(maint)

	r := mux.NewRouter()

	api := r.PathPrefix("/api").Subrouter()

	// Liveness for Render's health check: unauthenticated (it sends no cookie),
	// and it proves the Go router is up, unlike "/", which is just index.html.
	// NEVER gated by maintenance — a 503 here would make Render flap the service.
	api.Handle("/health", health.Handler(hub.ClientCount)).Methods(http.MethodGet)

	// Maintenance status: unauthenticated, always 200 — the client polls it.
	api.Handle("/status", maintenance.Status(maint)).Methods(http.MethodGet)

	// Session routes and the socket are refused (503) during maintenance, so
	// no new logins or connections happen. The gate sits outside auth so a
	// parked client sees 503, not 401.
	api.Handle("/session", gate(http.HandlerFunc(a.Login))).Methods(http.MethodPost)
	api.Handle("/session", gate(http.HandlerFunc(a.Session))).Methods(http.MethodGet)
	api.Handle("/session", gate(http.HandlerFunc(a.Logout))).Methods(http.MethodDelete)

	r.Handle("/ws", gate(a.Require(ws.Handler(hub))))

	// Everything else is the built SPA (embedded). As the NotFound handler it
	// only runs when no route above matched, so /api and /ws always win (and
	// a wrong method on a real route still gets mux's 405). Single origin
	// everywhere — Go serves the app in prod, Vite proxies to us in dev — so
	// there's no CORS. Served during maintenance too, so the page can load
	// and show the maintenance screen.
	r.NotFoundHandler = web.Handler()

	return r
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
