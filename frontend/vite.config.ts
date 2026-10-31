import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // Plotly's source expects a browserify-style `global`, as its own build defines it.
  define: { global: "globalThis" },
  resolve: {
    alias: {
      // Plotly's registry imports the map stylesheet even when no map traces are registered.
      "maplibre-gl/dist/maplibre-gl.css": "/src/styles/empty.css",
    },
  },
});
