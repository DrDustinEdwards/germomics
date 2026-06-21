-- 0000_content_and_fts.sql — reconciliation baseline.
-- The content tables, indexes, FTS5 virtual table and sync triggers ALREADY EXIST in the
-- live D1 (dumped in docs/db_schema.sql). Every statement here is IF NOT EXISTS, so applying
-- this is a no-op on the populated remote D1 and builds everything fresh on a local D1.
-- Nothing is dropped.

CREATE TABLE IF NOT EXISTS posts (
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

CREATE TABLE IF NOT EXISTS post_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  snapshot TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS show_config (
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

CREATE UNIQUE INDEX IF NOT EXISTS posts_slug_idx ON posts (slug);
CREATE UNIQUE INDEX IF NOT EXISTS posts_guid_idx ON posts (guid);
CREATE INDEX IF NOT EXISTS posts_feed_idx ON posts (kind, status, published_at);
CREATE INDEX IF NOT EXISTS post_versions_post_idx ON post_versions (post_id);

-- External-content FTS5 mirror of posts(title, body, excerpt), kept in sync by triggers.
CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(title, body, excerpt, content='posts', content_rowid='id');

CREATE TRIGGER IF NOT EXISTS posts_ai AFTER INSERT ON posts BEGIN
  INSERT INTO posts_fts(rowid, title, body, excerpt) VALUES (new.id, new.title, new.body, new.excerpt);
END;

CREATE TRIGGER IF NOT EXISTS posts_au AFTER UPDATE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, title, body, excerpt) VALUES('delete', old.id, old.title, old.body, old.excerpt);
  INSERT INTO posts_fts(rowid, title, body, excerpt) VALUES (new.id, new.title, new.body, new.excerpt);
END;

CREATE TRIGGER IF NOT EXISTS posts_ad AFTER DELETE ON posts BEGIN
  INSERT INTO posts_fts(posts_fts, rowid, title, body, excerpt) VALUES('delete', old.id, old.title, old.body, old.excerpt);
END;
