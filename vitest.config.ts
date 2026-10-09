// THE FIRST TEST SUITE THIS REPO HAS HAD.
//
// germomics has shipped with no `test` script and no test files, which is the blocker
// germomics/TASK-security-deps.md has recorded since 2026-09-06: a dependency bump has nothing
// to verify it beyond typecheck and build, and neither notices a behavioural regression in auth
// or rendering. This is the minimum suite that makes the better-auth bump landable.
//
// WORKERS POOL, NOT NODE, and that is forced rather than chosen. app/lib/sanitize.server.ts is
// the XSS boundary on every post body and it is built on the Workers `HTMLRewriter` global,
// which plain `node --test` has no implementation of. That is exactly why the improve loop's
// hidden holdout suite could never cover it. A miniflare-backed runner is the only place it can
// be tested at all, so the whole suite runs there.
//
// WHAT THIS DELIBERATELY DOES NOT COVER: app/lib/format.ts, app/lib/vtt.ts and
// app/lib/r2.server.ts. The improve loop's holdout suite already covers those 27 cases, and the
// task doc is explicit that duplicating them here would be wasted effort AND would let an
// attempt satisfy the hidden suite by reading the visible one.
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
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
          // Obviously fake, and never a real value: capsid/conventions.md forbids real content
          // in any fixture. The auth tests assert the single-admin lock's BEHAVIOUR against
          // this address, so it has to be a known constant rather than the real one.
          ADMIN_EMAIL: "admin@example.com",
          BETTER_AUTH_SECRET: "test-only-secret-not-a-real-one",
          BETTER_AUTH_URL: "http://localhost:5173",
          GOOGLE_CLIENT_ID: "test-google-client-id",
          GOOGLE_CLIENT_SECRET: "test-google-client-secret",
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
