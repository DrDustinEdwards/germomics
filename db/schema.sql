-- db/schema.sql canonical DDL for the germomics D1 database.
--
-- Dumped verbatim from the live D1 instance (germomics,
-- fbdeae30-5986-4816-9b7c-21136d8e372c) via the Cloudflare D1 API, not hand-authored.
-- This is documentation of what is already applied; the live database is the source of
-- truth and db/schema.ts is the Drizzle view of it. FTS5 (posts_fts + triggers) is not
-- expressible in Drizzle's schema DSL, which is why it lives here.
--
-- Regenerate with:
--   SELECT sql FROM sqlite_master
--   WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '%_fts_%'
--   ORDER BY ...;
-- (Cloudflare's internal _cf_KV table is intentionally omitted.)

CREATE TABLE posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL DEFAULT 'article' CHECK (kind IN ('episode','article')),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  excerpt TEXT,
  cover_image TEXT,
  tags TEXT DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  featured INTEGER NOT NULL DEFAULT 0,
  seo_title TEXT,
  seo_description TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  audio_url TEXT,
  audio_duration INTEGER,
  audio_byte_size INTEGER,
  audio_mime_type TEXT DEFAULT 'audio/mpeg',
  episode_number INTEGER,
  season_number INTEGER,
  episode_type TEXT DEFAULT 'full' CHECK (episode_type IN ('full','trailer','bonus')),
  explicit INTEGER DEFAULT 0,
  guid TEXT,
  transcript TEXT,
  chapters TEXT,
  guests TEXT,
  episode_artwork TEXT
);

CREATE UNIQUE INDEX posts_slug_idx ON posts (slug);
CREATE UNIQUE INDEX posts_guid_idx ON posts (guid);
CREATE INDEX posts_feed_idx ON posts (kind, status, published_at);

-- Full-text search over posts, kept in sync by the triggers below.
CREATE VIRTUAL TABLE posts_fts USING fts5(title, body, excerpt, content='posts', content_rowid='id');

CREATE TRIGGER posts_ai AFTER INSERT ON posts BEGIN
  INSERT INTO posts_fts(rowid, title, body, excerpt) VALUES (new.id, new.title, new.body, new.excerpt);
END;

CREATE TRIGGER posts_au AFTER UPDATE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, title, body, excerpt) VALUES('delete', old.id, old.title, old.body, old.excerpt);
  INSERT INTO posts_fts(rowid, title, body, excerpt) VALUES (new.id, new.title, new.body, new.excerpt);
END;

CREATE TRIGGER posts_ad AFTER DELETE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, title, body, excerpt) VALUES('delete', old.id, old.title, old.body, old.excerpt);
END;

CREATE TABLE post_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX post_versions_post_idx ON post_versions (post_id);

CREATE TABLE show_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  author TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  artwork TEXT NOT NULL,
  apple_category TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en-us',
  itunes_type TEXT NOT NULL DEFAULT 'episodic' CHECK (itunes_type IN ('episodic','serial')),
  explicit INTEGER NOT NULL DEFAULT 0,
  subscribe_links TEXT,
  funding_url TEXT
);
