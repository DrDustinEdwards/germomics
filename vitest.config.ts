// Workers runtime, not Node, because app/lib/sanitize.server.ts is
// the XSS boundary on every post body and it is built on the Workers `HTMLRewriter` global,
// which plain `node --test` has no implementation of. A miniflare-backed runner is the only
// place it can be tested at all, so the whole suite runs there.
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        compatibilityDate: "2026-06-21",
        compatibilityFlags: ["nodejs_compat"],
        // Bindings are declared HERE rather than read from wrangler.jsonc, deliberately: the
        // real config names the production D1 database and R2 buckets, and a test run must
        // never be one typo away from touching them. These are empty local equivalents.
        d1Databases: ["DB"],
        kvNamespaces: ["APP_KV"],
        r2Buckets: ["MEDIA", "BLOG_IMAGES", "GAME_ASSETS", "BACKUPS"],
        bindings: {
          // Fake values only, never a real one.
          ADMIN_EMAIL: "admin@example.com",
          BETTER_AUTH_SECRET: "test-only-secret-not-a-real-one",
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
