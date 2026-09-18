// Package respond writes JSON HTTP responses in one consistent shape, so every
// endpoint (and the frontend that reads them) agrees on the format.
package respond

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// errorBody is the JSON shape of every error the API returns: { "message": ... }.
type errorBody struct {
	Message string `json:"message"`
}

// Error writes a JSON error body with the given status code, e.g.
//
//	respond.Error(w, http.StatusUnauthorized, "unauthorized")
//
// produces  401  { "message": "unauthorized" }.
func Error(w http.ResponseWriter, status int, message string) {
	JSON(w, status, errorBody{Message: message})
}

// JSON writes v as a JSON body with the given status code. Responses with no
// body (204) shouldn't use this — just call w.WriteHeader.
func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		slog.Error("respond: failed to encode body", "err", err)
	}
}
