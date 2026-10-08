# dogspeak — one image, one origin (prod only; dev never uses Docker).
# The Go binary embeds the built SPA and serves it next to /api and /ws.

# 1. Build the client.
FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package.json client/yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000
COPY client/ ./
# Relative URLs: the app talks to whatever origin served it.
ENV VITE_API_BASE_URL=""
RUN yarn build

# 2. Build the server, embedding the client bundle where go:embed expects it.
FROM golang:1.24-alpine AS server
WORKDIR /app/server
COPY server/go.mod server/go.sum ./
RUN go mod download
COPY server/ ./
RUN rm -rf pkg/web/dist
COPY --from=client /app/client/dist ./pkg/web/dist
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /dogspeak ./cmd/api

# 3. Run it. Listens on $PORT (Render injects it; 8080 otherwise).
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=server /dogspeak /dogspeak
ENV ENV=production LOG_FORMAT=json
EXPOSE 8080
ENTRYPOINT ["/dogspeak"]
