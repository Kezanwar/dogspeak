package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/mux"

	"dogspeak-server/pkg/auth"
	"dogspeak-server/pkg/ws"
)

func main() {
	a := auth.New(auth.Config{
		Password:     mustEnv("ROOM_PASSWORD"),
		Secret:       []byte(mustEnv("SESSION_SECRET")),
		CookieDomain: os.Getenv("COOKIE_DOMAIN"),           // "" for localhost dev
		CookieSecure: os.Getenv("COOKIE_SECURE") == "true", // false for http://localhost
		TTL:          7 * 24 * time.Hour,
	})

	hub := ws.NewHub()

	r := mux.NewRouter()

	// /session is a resource: POST = log in, GET = check/refresh, DELETE = log out.
	r.HandleFunc("/session", a.Login).Methods(http.MethodPost)
	r.HandleFunc("/session", a.Session).Methods(http.MethodGet)
	r.HandleFunc("/session", a.Logout).Methods(http.MethodDelete)

	// The WebSocket is gated by a valid session cookie.
	r.Handle("/ws", a.Require(ws.Handler(hub)))

	addr := ":" + port()
	log.Println("dogspeak server listening on", addr)
	log.Fatal(http.ListenAndServe(addr, r))
}

// mustEnv returns the env var or exits — secrets must be set, never defaulted.
func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("missing required env var %s", key)
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
