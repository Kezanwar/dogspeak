// Single origin everywhere: relative URLs hit whatever served the page — the
// Go server in prod, the Vite dev server in dev (which proxies /api and /ws
// through to Go; see vite.config.ts). Leave VITE_API_BASE_URL unset or "".
export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

// The socket, same origin as the page (wss under https). In dev that is
// ws://localhost:5173/ws, which Vite relays to the Go server.
export const WS_URL = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`;

export const IS_DEV = import.meta.env.VITE_APP_ENV === "development";
