import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Security headers for every page and file of the built site. The page talks to two outside hosts: the backend
 * (VITE_API_URL) and Supabase, for sign-in (VITE_SUPABASE_URL). `npm run preview` sends them too, so a local check
 * matches the live site.
 */
function headers(env: Record<string, string>): Record<string, string> {
  const connect = ["'self'", env.VITE_API_URL, env.VITE_SUPABASE_URL].filter(Boolean).map((u) => u.replace(/\/$/, ""));
  return {
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self'",
      // Monaco and Plotly set inline styles; Monaco runs its language workers from blob: URLs.
      "style-src 'self' 'unsafe-inline'",
      "worker-src 'self' blob:",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      `connect-src ${connect.join(" ")}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Cross-Origin-Opener-Policy": "same-origin",
  };
}

/** Writes the headers into dist/_headers, which Cloudflare Pages reads. */
function securityHeaders(h: Record<string, string>): Plugin {
  return {
    name: "security-headers",
    apply: "build",
    generateBundle() {
      const lines = Object.entries(h).map(([k, v]) => `  ${k}: ${v}`);
      this.emitFile({ type: "asset", fileName: "_headers", source: `/*\n${lines.join("\n")}\n` });
    },
  };
}

export default defineConfig(({ mode }) => {
  // The project folder: Vite runs the config from here.
  const env = loadEnv(mode, ".", "VITE_");
  const h = headers(env);
  return {
    plugins: [react(), securityHeaders(h)],
    // Locally the IDE talks to the backend through this proxy (uv run uvicorn receipts.server:app --port 8000).
    server: { port: 5173, proxy: { "/api": "http://localhost:8000" } },
    preview: { port: 5182, headers: h },
    // Plotly's source expects a browserify-style `global`, as its own build defines it.
    define: { global: "globalThis" },
    resolve: {
      alias: {
        // Plotly's registry imports the map stylesheet even when no map traces are registered.
        "maplibre-gl/dist/maplibre-gl.css": "/src/styles/empty.css",
      },
    },
  };
});
