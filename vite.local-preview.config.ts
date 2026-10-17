import { defineConfig } from "vite";
import { sites } from "./build/sites-vite-plugin";

// Local built preview: reuse the existing loopback-only mock sign-in.
// Cloudflare's development module runner is intentionally not loaded here.
export default defineConfig({
  plugins: [sites({ mockAuth: true })],
  // The app and its assets are already built and served by Wrangler.
  // Avoid scanning generated HTML and checkout-local caches in this proxy.
  optimizeDeps: { noDiscovery: true, include: [] },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    watch: null,
    proxy: { "/": { target: "http://127.0.0.1:8787" } },
  },
});
