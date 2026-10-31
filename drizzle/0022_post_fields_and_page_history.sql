-- Carrel's v0.18.0 post fields and a history for every write (app/lib/carrel/adapter.server.ts). Hand-written, kept in
-- step with app/db/schema.ts (test/schema.test.ts), applied with:
--   wrangler d1 migrations apply germomics [--local|--remote]
--
-- ADDITIVE: five nullable columns and one new table; no existing row is touched.
--
-- authors: the post's own credit, a JSON list of display names (NULL: the show's author, show_config.author).
-- series, series_part: the series a post belongs to and its place in it ("Part 2 of 3"), both NULL for none.
ALTER TABLE posts ADD COLUMN authors TEXT;
ALTER TABLE posts ADD COLUMN series TEXT;
ALTER TABLE posts ADD COLUMN series_part INTEGER;

-- What each snapshot was taken before (save, publish, rename...) and who made that change. NULL on the rows before this
-- migration, which were all taken before an edit.
ALTER TABLE post_versions ADD COLUMN event TEXT;
ALTER TABLE post_versions ADD COLUMN author TEXT;

-- A Markdown page's history, as post_versions is a post's: the block as it was before each Carrel write.
CREATE TABLE IF NOT EXISTS content_block_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  block_key TEXT NOT NULL,
  snapshot TEXT NOT NULL,
  event TEXT,
  author TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS content_block_versions_key_idx ON content_block_versions (block_key);
