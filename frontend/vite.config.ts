import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Locally the IDE talks to the backend through this proxy (uv run uvicorn receipts.server:app --port 8000).
  // The static site has no backend, so its /api requests fail and the chat replays saved checks instead.
  server: { port: 5173, proxy: { "/api": "http://localhost:8000" } },
  // Plotly's source expects a browserify-style `global`, as its own build defines it.
  define: { global: "globalThis" },
  resolve: {
    alias: {
      // Plotly's registry imports the map stylesheet even when no map traces are registered.
      "maplibre-gl/dist/maplibre-gl.css": "/src/styles/empty.css",
    },
  },
});
