-- 0002_editor_blog.sql — Tier 1 shared editor + blog. ADDITIVE and backward-compatible.
--
-- The 10 migrated episodes must keep rendering identically, so nothing is dropped or rebuilt:
--   * New posts columns via ADD COLUMN only (no CHECK rebuild). Scheduling rides on a new
--     `publish_at` + a publish-on-read gate, so the status CHECK stays (draft|published) and a
--     "scheduled" post is simply status=published with a future publish_at (hidden until due).
--   * New tables (people / episode_people / soundbites) are independent; FTS5 + its triggers
--     are untouched. Existing guests/chapters JSON columns stay as the raw-input fallback.

-- New posts columns -----------------------------------------------------------
ALTER TABLE posts ADD COLUMN publish_at TEXT;            -- scheduling gate (ISO-UTC)
ALTER TABLE posts ADD COLUMN cover_alt TEXT;             -- alt text for cover_image
ALTER TABLE posts ADD COLUMN episode_artwork_alt TEXT;   -- alt text for episode_artwork
ALTER TABLE posts ADD COLUMN og_image TEXT;              -- per-post social/OG image
ALTER TABLE posts ADD COLUMN og_image_alt TEXT;          -- alt text for og_image
ALTER TABLE posts ADD COLUMN audio_peaks TEXT;           -- JSON number[] waveform peaks (0..1)

-- People as reusable entities -------------------------------------------------
CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  role TEXT,
  bio TEXT,
  photo TEXT,
  photo_alt TEXT,
  links TEXT DEFAULT '[]',                               -- JSON [{ label, url }]
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS people_slug_idx ON people (slug);

-- Episode <-> person links (per-episode role + display order) ------------------
CREATE TABLE IF NOT EXISTS episode_people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role TEXT,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS episode_people_uniq ON episode_people (post_id, person_id);
CREATE INDEX IF NOT EXISTS episode_people_post_idx ON episode_people (post_id);

-- Soundbites — SCHEMA ONLY this pass (editor deferred to Tier 2/3) -------------
CREATE TABLE IF NOT EXISTS soundbites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  start_seconds INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL,
  title TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS soundbites_post_idx ON soundbites (post_id);
