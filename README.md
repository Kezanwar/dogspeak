# dogspeak

Browser-only voice chat for a handful of mates (WebRTC mesh). `server/` is the
Go signalling server, `client/` the React SPA. `docs/events.md` is the
WebSocket contract.

## One origin, everywhere

The browser only ever talks to **one origin**, so the httpOnly session cookie
is first-party (`SameSite=Lax`) and there is no CORS:

- **prod** — the Go server serves the built SPA (embedded with `go:embed`)
  alongside `/api` and `/ws`.
- **dev** — Vite serves the app on `:5173` with HMR and proxies only `/api`
  and `/ws` to the Go server on `:8080` (`client/vite.config.ts`).

The client uses relative URLs (`/api`, and `ws(s)://<page host>/ws`).

## Dev (two processes, no Docker)

```sh
# server — copy server/.env.example to server/.env and fill it in
cd server && make dev          # :8080

# client — copy client/.env.example to client/.env (VITE_API_BASE_URL empty)
cd client && yarn && yarn dev  # http://localhost:5173  ← open this
```

Go compiles without a client build: `server/pkg/web/dist/index.html` is a
committed placeholder for the embed. Go never serves the SPA in dev.

## Prod (one Docker image)

```sh
docker build -t dogspeak .
docker run -p 8080:8080 -e ROOM_PASSWORD=… -e SESSION_SECRET=… dogspeak
```

The multi-stage `Dockerfile` builds the client, embeds `client/dist` into the
Go binary, and runs it on a distroless base. It sets `ENV=production`
(Secure cookie) and JSON logs. Over plain http (e.g. the local `docker run`
above) add `-e ENV=` so the cookie isn't Secure-only.

### Render

One **Web Service** (Docker runtime) from the repo root `Dockerfile`, with no
separate static site. `render.yaml` is the blueprint; its health check is
`GET /api/health` (unauthenticated, returns `{"status":"ok","clients":N}`). Env:

| var              | value                                                   |
| ---------------- | ------------------------------------------------------- |
| `ROOM_PASSWORD`  | the room password (required)                            |
| `SESSION_SECRET` | random secret for signing session cookies (required)    |
| `COOKIE_SECURE`  | `true` (or `ENV=production`, already set by the image)  |
| `PORT`           | provided by Render                                      |

Optional: `LOG_LEVEL` (`debug|info|warn|error`), `LOG_FORMAT` (`text|json`),
`COOKIE_DOMAIN` (leave blank).
