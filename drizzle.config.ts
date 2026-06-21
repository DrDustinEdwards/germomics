import type { Config } from "drizzle-kit";

// drizzle-kit is used to GENERATE migrations from schema changes (npm run db:generate).
// Migrations are APPLIED with wrangler (npm run db:migrate / :prod) so they run against the
// real D1 binding, matching CLAUDE.md ("generate with drizzle-kit, apply with wrangler").
// The two baseline migrations in drizzle/ are hand-authored to reconcile against the live
// D1 (content tables + FTS5 already exist) without dropping anything.
export default {
  schema: "./app/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "d1-http",
} satisfies Config;
