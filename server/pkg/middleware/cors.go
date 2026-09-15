package middleware

import "net/http"

// Cors returns middleware that lets the given origins make credentialed
// (cookie-bearing) cross-origin requests to the API.
//
// Because the API sends credentials, the CORS spec forbids the "*" wildcard for
// the allowed origin: the server must echo back the specific requesting origin,
// and only when it's on the allowlist. Blindly reflecting any origin back while
// allowing credentials would let ANY website make authenticated requests on a
// logged-in user's behalf — so the allowlist check is the security boundary.
//
// Apply it as the OUTERMOST handler, wrapping the whole router, so preflight
// (OPTIONS) requests are answered before route/method matching. With gorilla/mux,
// r.Use middleware doesn't reliably run for a method-mismatched OPTIONS, so
// wrapping the router is the robust placement.
func Cors(allowedOrigins []string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		allowed[o] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" {
				if _, ok := allowed[origin]; ok {
					w.Header().Set("Access-Control-Allow-Origin", origin)
					w.Header().Set("Access-Control-Allow-Credentials", "true")
					w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
					w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
					w.Header().Set("Access-Control-Max-Age", "600")
					// The response varies by origin, so caches must key on it.
					w.Header().Add("Vary", "Origin")
				}
			}

			// Answer the preflight and stop — the real handler doesn't run for it.
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
