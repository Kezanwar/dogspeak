# 🐕 dogspeak

Browser voice chat for the mates — so we can bin TeamSpeak.

A lean, self-hosted WebRTC voice app for a small group (~5). Audio is peer-to-peer; a small Go server only does introductions. Runs happily alongside the guild's Discord.

---

## What it does

- **Peer-to-peer voice** — join a channel and talk, open-mic. Audio flows directly between browsers (WebRTC mesh), so the server isn't in the path of your call.
- **Voice + text channels** — a global text chat plus voice channels (`general`, `lounge`, `afk`), with Discord-style "viewing vs being in" (read the chat while you're talking in a channel).
- **Live presence** — see who's connected, who's in which channel, and a green glow on whoever's speaking (local voice-activity detection).
- **Mute & volume control** — self-mute (broadcast), mute/quieten individual people just for yourself, plus your own master output and mic-gain sliders. Persisted across refreshes.
- **Grid view** — a tile per person in a voice channel, with per-person controls.
- **Identity-lite** — a per-browser id keeps your chat messages "yours" across reloads and keeps names/colours live, with no database or accounts.
- **One tab at a time** — opening a second tab takes over; the old one parks on a "connected elsewhere" screen.
- **Maintenance mode** — flip an env flag to cleanly park everyone on a maintenance screen around a deploy; they auto-reconnect when it's off.

---

## How it works

- **Audio is a p2p mesh** within a channel (STUN only — no TURN, no SFU). The Go server only handles signalling, presence and chat, so established calls survive a server restart.
- **Single-origin** — in production the Go server embeds and serves the built web app, so the app, the API (`/api`) and the WebSocket (`/ws`) all share one origin. That keeps the auth cookie first-party and means there's no CORS.
- **Auth** is a shared room password → a stateless JWT in an httpOnly cookie. It's a trust gate for mates, not real per-user accounts.
- **The WebSocket contract is the source of truth**, kept in sync across three files: [`docs/events.md`](docs/events.md), `server/pkg/ws/message.go`, and `client/src/socket/events.ts`.

---

## Tech stack

**Frontend** — React 19, Vite, TypeScript (strict), Tailwind v4, shadcn/ui, MobX, react-hook-form + yup, axios.

**Backend** — Go — gorilla/websocket, gorilla/mux, golang-jwt, `slog` (+ tint for dev logs).

**Deploy** — Docker (multi-stage) on Render, single service, single origin.

---

## Project structure

```
.
├── client/        # React SPA (Vite)
├── server/        # Go signalling server
│   ├── cmd/api/   # entrypoint
│   └── pkg/       # ws, auth, jwt, web (SPA embed), middleware, ...
├── docs/
│   └── events.md  # the WebSocket contract
├── Dockerfile     # multi-stage: build client → build server (embeds dist) → run
└── README.md
```

---

## Local development

Dev runs as two processes, but the Vite dev server proxies `/api` and `/ws` through to the Go server, so the browser is effectively **single-origin** with HMR intact.

**Prerequisites:** Go 1.24+, Node 22+, Yarn.

```bash
# 1. server — copy the example env and fill it in
cp server/.env.example server/.env   # set ROOM_PASSWORD + SESSION_SECRET
make run                             # or: cd server && go run ./cmd/api   (listens on :8080)

# 2. client
cd client && yarn install
yarn dev                             # http://localhost:5173
```

Then open **http://localhost:5173** and log in with your `ROOM_PASSWORD`.

> `make dev` runs both together — see the `makefile` for the exact targets.

**WebRTC negotiation e2e** — with the app running, `cd client && yarn e2e:webrtc`. Two browsers join a voice channel across several scenarios (duplicate offer, mic blocked then retried, slow mic, late candidates…) and it asserts ICE connects on both sides, audio flows, and each pair negotiates exactly once. Env: `DOGSPEAK_URL` (default `http://localhost:5173`), `DOGSPEAK_PASSWORD`, `CHROMIUM_PATH`.

---

## Environment variables

**Server**

| Variable         | Required | Default   | Notes                                              |
| ---------------- | -------- | --------- | -------------------------------------------------- |
| `ROOM_PASSWORD`  | ✅       | —         | Shared login password.                             |
| `SESSION_SECRET` | ✅       | —         | JWT signing secret (use a long random string).     |
| `PORT`           |          | `8080`    | Injected by Render in prod — don't hardcode there. |
| `COOKIE_SECURE`  |          | `false`   | `true` in prod (HTTPS).                            |
| `COOKIE_DOMAIN`  |          | _(blank)_ | Leave blank (host-only cookie).                    |
| `MAINTENANCE`    |          | `false`   | `true` parks all clients on a maintenance screen.  |
| `LOG_LEVEL`      |          | `info`    | `debug` \| `info` \| `warn` \| `error`.            |
| `LOG_FORMAT`     |          | `text`    | `json` in prod.                                    |

**Client** (`client/.env`)

| Variable            | Notes                                                                      |
| ------------------- | -------------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | Leave **empty** — the app uses relative URLs (single-origin / Vite proxy). |

---

## Deploy (Render)

Deployed as a single **Docker web service** (the multi-stage `Dockerfile` builds the client, then the Go binary with the built SPA embedded). Set the server env vars above (with `COOKIE_SECURE=true`, `LOG_FORMAT=json`), and leave `PORT` to Render.

- **`main` is production.** The service auto-deploys new commits on `main`, so a merge to `main` is a live deploy.
- **Deploying with people connected** will drop and re-establish their connections. To do it cleanly, set `MAINTENANCE=true` first (parks everyone), deploy, then set it back to `false`.

---

## Conventions

- **Branching:** work on feature branches → PR into `develop`. Merge `develop` → `main` to release (that's what deploys).
- **The WS contract** (`docs/events.md` ↔ `server/pkg/ws/message.go` ↔ `client/src/socket/events.ts`) must stay in sync whenever events change.
- British **`colour`** spelling throughout; lowercase UI labels.
- See `CLAUDE.md` for the architectural invariants.

---

## Scope (on purpose)

Mates only (~5), mesh forever (no relay/SFU), open-mic, browser-only (no Electron), no database. It's deliberately small — if it ever needs accounts, cross-device identity or screen sharing, those are noted in the backlog, not built.

---

_A side project. No warranty — have fun._
