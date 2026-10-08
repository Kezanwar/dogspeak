import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: [{ find: "@app", replacement: "/src" }],
  },
  plugins: [react(), tailwindcss()],
  server: {
    // Dev is same-origin in the browser too: Vite serves the app (with HMR)
    // on :5173 and relays only /api and /ws to the Go server on :8080, so the
    // session cookie is first-party and there's no CORS. /ws keeps the
    // browser's Host (no changeOrigin) so the server's same-origin check
    // passes. Vite's own HMR socket is separate and unaffected.
    proxy: {
      "/api": { target: "http://localhost:8080", changeOrigin: true },
      "/ws": { target: "ws://localhost:8080", ws: true },
    },
  },
});
