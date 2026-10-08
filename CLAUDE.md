# dogspeak

Browser-only voice chat for ~5 mates (WebRTC mesh), alongside guild Discord.
Monorepo: `server/` (Go signalling server) + `client/` (React SPA).
`docs/events.md` is the WebSocket contract and the source of truth.

## Git flow

- Branch off `develop`. Open PRs against `develop`. Never commit directly to `develop` or `main`.
- Branch names: `feat/...`, `fix/...`, `chore/...`.

## Before building

- Read `docs/events.md` (the WS contract) and the files you'll touch.
- Changing an event = update ALL of: `server/pkg/ws/message.go`, `router.go`,
  `docs/events.md`, and the client `events.ts` + presence `apply`. Keep them in sync.

## Architectural invariants (do not break)

- **Auth = httpOnly session cookie**, gated server-side by `auth.Require` on `/ws`.
  The client `isAuthenticated` flag is UX only — the server is the security boundary.
- **Presence is server-wide; signalling is channel-scoped.**
- **The server broadcasts presence changes to everyone EXCEPT the sender.** So changing
  your own name/colour/channel must update local state AND send — always go through
  `PresenceStore.setName/setColour/joinChannel`, never raw `socket.send` for these.
- **Channels are frontend-owned vocabulary** (`general`, `lounge`, `afk`; afk has no audio).
  The server treats `channel` as an opaque string. `""` = lobby, and is OMITTED on the
  wire (treat absent as `""`). One voice channel at a time.
- **Text chat is global**, not tied to voice channels (usable from the lobby). The main panel's
  *view* (`ui.view`: text or a voice channel) is separate from voice membership (`presence.myChannel`);
  changing the view must never join/leave voice.

## Server (`server/`, Go)

- Packages under `pkg/`: `ws` (hub/client/router/message), `auth`, `jwt`, `middleware`, `respond`, `web` (embedded SPA), `health`
  (`GET /api/health`, unauthenticated liveness — Render's health check). Entry: `cmd/api`.
- **Single origin, no CORS.** Prod: Go serves the built SPA (`go:embed`, `pkg/web/dist` — keep the committed
  placeholder `index.html`) as the router's NotFound handler, after `/api` and `/ws`. Dev: Vite proxies `/api` + `/ws`
  to `:8080`. `/ws` accepts same-origin handshakes only. Deploy = one Docker image (root `Dockerfile`, `render.yaml`).
- `make dev` runs it (loads `.env`); `make test` runs tests. Always `gofmt`, `go vet`, `go test ./...` before a PR.
- Structured logging via `slog`. JSON errors via `respond.Error`. No database — sessions are stateless JWT cookies.

## Client (`client/`, React + Vite + TS)

- TS strict: `verbatimModuleSyntax` (use `import type` for types), `noUncheckedIndexedAccess`. Path alias `@app/* -> client/src/*`.
- State: MobX + mobx-react-lite. Wrap store-reading components in `observer` (from `@app/stores`).
  Mutate observables only in actions; use `runInAction` after `await`.
- UI: Tailwind v4 + shadcn/ui (`client/src/components/ui`).
- HTTP: axios, relative `baseURL` `/api` (`VITE_API_BASE_URL` empty), `withCredentials: true`. WS URL derives from `location`. Socket: singleton in `src/socket/socket.ts`; types in `src/socket/events.ts` (mirrors `docs/events.md`).
- **Spelling: British `colour`** everywhere (wire fields + variables). **UI labels are lowercase** ("general", "lounge", "afk").
- Run `tsc`/build before a PR.

## Scope discipline

- Don't touch auth unless the task is auth.
- No WebRTC audio / VAD until the audio milestone — the speaking glow reads a stubbed `false` source for now.
