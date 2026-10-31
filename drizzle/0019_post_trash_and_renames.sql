-- Carrel's v0.17.0 post writes (app/lib/carrel/adapter.server.ts). Hand-written, kept in step with app/db/schema.ts
-- (test/schema.test.ts), applied with:
--   wrangler d1 migrations apply germomics [--local|--remote]
--
-- ADDITIVE: two nullable columns and one new table; no existing row is touched.
--
-- trashed_at: when Carrel moved the post to its trash (NULL: not trashed). A trashed post is a draft, so no public read
-- shows it, and site-api's cron deletes it for good after 30 days.
-- schedule_change_id: the Carrel change that scheduled a post never yet live (status published, publish_at ahead), so
-- the cron's pass that hears it go live records it under that change. NULL for a post scheduled before this column.
ALTER TABLE posts ADD COLUMN trashed_at TEXT;
ALTER TABLE posts ADD COLUMN schedule_change_id TEXT;

-- A renamed post's old slug, kept so /<old slug> (and its transcript.vtt and chapters.json) answer a permanent redirect
-- to wherever the post lives now. Keyed by the old slug and pointing at the post's id, so a second rename needs no
-- chain, and a deleted post takes its old slugs with it.
CREATE TABLE IF NOT EXISTS post_redirects (
  from_slug TEXT PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
