-- The media library (site-api v0.13.1, Carrel's media page): one row per image in BLOG_IMAGES, so a file can carry what
-- R2 listing alone cannot (alt, tags, trash, a content hash, credit and license, a version that moves on every write),
-- plus each file's byte history and a change log a screen polls. Hand-written (drizzle-kit is not used), kept in step
-- with app/db/schema.ts (test/schema.test.ts). Applied with:
--   wrangler d1 migrations apply germomics [--local|--remote]
--
-- ADDITIVE: three new tables, three indexes and three triggers; no existing row is touched. The images already in
-- BLOG_IMAGES get their rows from the backfill (app/lib/media/backfill.server.ts, POST /admin/media/backfill), which
-- copies each object's alt, filename, focal point and size and its caption from media_captions (0014). media_captions
-- stays in place, read only by that backfill from then on.

-- The R2 object is the bytes and the public address (images.germomics.com/<key>); this row is everything else.
CREATE TABLE media (
  -- The BLOG_IMAGES key, which is also Carrel's media id.
  key TEXT PRIMARY KEY,
  filename TEXT,
  content_type TEXT NOT NULL,
  bytes INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  alt TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  -- A JSON array of tags in site-api's spelling (lower case words joined by hyphens).
  tags TEXT NOT NULL DEFAULT '[]',
  -- The focal point, "XxY": a copy of the object's customMetadata `focus`, which /media crops by.
  focus TEXT,
  credit TEXT NOT NULL DEFAULT '',
  license TEXT NOT NULL DEFAULT '',
  source_url TEXT,
  -- YYYY-MM-DD
  license_expires TEXT,
  -- When the picture was taken, from its embedded metadata.
  taken_at TEXT,
  -- The SHA-256 of the object's current bytes, lower case hex.
  sha256 TEXT,
  -- An ISO time while the file is in the trash; a trashed file keeps its object and address.
  trashed_at TEXT,
  -- Moves on every write to this row's editable fields or the bytes, checked in the same statement.
  rev INTEGER NOT NULL DEFAULT 0,
  -- ISO time.
  uploaded_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX media_sha256_idx ON media (sha256);

-- One row per set of bytes a file has had. The newest row for a key is its current bytes, in BLOG_IMAGES; every earlier
-- row names the copy kept in BACKUPS under media/revisions/ (`backup_key`), which nothing deletes. d1-dump prunes only
-- its own backups/json/ prefix.
CREATE TABLE media_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_key TEXT NOT NULL,
  at TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  -- upload | import | replace | transform | resize | revert
  reason TEXT NOT NULL,
  sha256 TEXT,
  backup_key TEXT
);
CREATE INDEX media_revisions_key_idx ON media_revisions (media_key, id);

-- Every change to a media row, in order: what `changedSince` answers from. Triggers rather than a write in each writer,
-- so the backfill, the admin upload and a delete are logged as surely as a Carrel edit.
CREATE TABLE media_changes (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  media_key TEXT NOT NULL,
  at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX media_changes_key_idx ON media_changes (media_key, seq);

CREATE TRIGGER media_changes_ai AFTER INSERT ON media BEGIN
  INSERT INTO media_changes (media_key) VALUES (NEW.key);
END;
CREATE TRIGGER media_changes_au AFTER UPDATE ON media BEGIN
  INSERT INTO media_changes (media_key) VALUES (NEW.key);
END;
CREATE TRIGGER media_changes_ad AFTER DELETE ON media BEGIN
  INSERT INTO media_changes (media_key) VALUES (OLD.key);
END;
