import { defineConfig } from "vite";
import { resolve } from "node:path";

// Two pages, not a single-page app with a view toggle: each question needs its
// own URL so it can be linked to and found by search.
export default defineConfig({
  // "/" for a root deploy (Cloudflare Pages, Netlify, a user.github.io site);
  // "/<repo>/" for a GitHub project page. Set VITE_BASE at build time.
  base: process.env.VITE_BASE ?? "/",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        correlations: resolve(__dirname, "correlations.html"),
      },
    },
  },
});
