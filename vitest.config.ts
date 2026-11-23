// The suite runs in the Workers runtime (miniflare), with the compatibility date and flags wrangler.jsonc names.
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "./test/helpers/entry.ts",
      miniflare: {
        compatibilityDate: "2026-10-19",
        compatibilityFlags: [
          "nodejs_compat",
          "enable_request_signal",
          "global_fetch_strictly_public",
        ],
        // Bindings are declared HERE rather than read from wrangler.jsonc, deliberately: the
        // real config names the production D1 database and R2 buckets, and a test run must
        // never be one typo away from touching them. These are empty local equivalents.
        d1Databases: ["DB"],
        kvNamespaces: ["APP_KV"],
        // SQLite-backed, as wrangler.jsonc's migration declares it.
        durableObjects: { RATE_LIMITER: { className: "RateLimiter", useSQLite: true } },
        r2Buckets: ["MEDIA", "BLOG_IMAGES", "GAME_ASSETS", "BACKUPS"],
        bindings: {
          // Fake values only, never a real one.
          ADMIN_EMAIL: "admin@example.com",
        },
      },
    }),
  ],
  resolve: {
    // The app's own alias, so tests import the real modules rather than copies of them.
    alias: { "~": path.join(import.meta.dirname, "app") },
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
