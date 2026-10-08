// Package web serves the built React SPA (client/dist, embedded at compile
// time) from the Go server, so in prod the app, /api and /ws share one origin.
//
// In dev Go never serves this — Vite does, and proxies /api + /ws here — but
// the embed still needs a target, hence the committed placeholder
// dist/index.html. The Docker build overwrites dist/ with the real bundle.
package web

import (
	"embed"
	"errors"
	"io/fs"
	"net/http"
	"path"
	"strings"

	"dogspeak-server/pkg/respond"
)

//go:embed all:dist
var distFS embed.FS

// Handler serves the embedded SPA. See New.
func Handler() http.Handler {
	sub, err := fs.Sub(distFS, "dist")
	if err != nil {
		panic(err) // "dist" is a compile-time constant; can't happen
	}
	return New(sub)
}

// New serves an SPA from fsys. Mount it as the router's catch-all (NotFound
// handler), so /api and /ws routes always win:
//
//   - GET/HEAD of a real file → that file. Hashed files under assets/ get a
//     year-long immutable cache; anything else is revalidated.
//   - any other GET/HEAD → index.html (no-store), so client-side routes
//     survive a refresh. Except /api/*, /ws and missing assets/* → 404, so a
//     typo'd endpoint or stale chunk never gets HTML back.
//   - any other method → 404.
func New(fsys fs.FS) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			respond.Error(w, http.StatusNotFound, "not found")
			return
		}

		p := path.Clean("/" + r.URL.Path)
		if p == "/api" || strings.HasPrefix(p, "/api/") || p == "/ws" {
			respond.Error(w, http.StatusNotFound, "not found")
			return
		}

		name := strings.TrimPrefix(p, "/")
		if name != "" && name != "index.html" && isFile(fsys, name) {
			if strings.HasPrefix(name, "assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			} else {
				w.Header().Set("Cache-Control", "no-cache")
			}
			http.ServeFileFS(w, r, fsys, name)
			return
		}
		if strings.HasPrefix(name, "assets/") {
			respond.Error(w, http.StatusNotFound, "not found")
			return
		}

		serveIndex(w, r, fsys)
	})
}

func isFile(fsys fs.FS, name string) bool {
	st, err := fs.Stat(fsys, name)
	return err == nil && !st.IsDir()
}

func serveIndex(w http.ResponseWriter, r *http.Request, fsys fs.FS) {
	b, err := fs.ReadFile(fsys, "index.html")
	if errors.Is(err, fs.ErrNotExist) {
		http.NotFound(w, r)
		return
	}
	if err != nil {
		respond.Error(w, http.StatusInternalServerError, "could not read index.html")
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	if r.Method == http.MethodHead {
		return
	}
	_, _ = w.Write(b)
}
