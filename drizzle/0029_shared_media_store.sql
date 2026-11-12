-- contract: the media library's tables become site-api's standard ones (MEDIA_LIBRARY_SQL), which
-- its d1MediaStore writes in place of germomics' own store. media drops updated_at and makes sha256
-- NOT NULL (every row has one); media_revisions renames backup_key to copy_key and makes sha256 NOT
-- NULL; media_changes drops its `at` column and its index. Every row is copied as it is; the change
-- log keeps its sequence numbers, so a cursor Carrel holds still means the same place. Index and
-- trigger names become the standard ones. Hand-run with a Time Travel bookmark first:
--   npx wrangler d1 migrations apply germomics --remote
DROP TRIGGER media_changes_ai;
DROP TRIGGER media_changes_au;
DROP TRIGGER media_changes_ad;
CREATE TABLE __new_media (
  key TEXT PRIMARY KEY NOT NULL,
  filename TEXT,
  content_type TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  sha256 TEXT NOT NULL,
  alt TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  focus TEXT,
  credit TEXT NOT NULL DEFAULT '',
  license TEXT NOT NULL DEFAULT '',
  source_url TEXT,
  license_expires TEXT,
  taken_at TEXT,
  uploaded_at TEXT NOT NULL,
  trashed_at TEXT,
  rev INTEGER NOT NULL DEFAULT 0,
  placeholder TEXT,
  color TEXT
);
INSERT INTO __new_media (key, filename, content_type, bytes, width, height, sha256, alt, caption, tags, focus, credit, license, source_url, license_expires, taken_at, uploaded_at, trashed_at, rev, placeholder, color)
SELECT key, filename, content_type, bytes, width, height, coalesce(sha256, ''), alt, caption, tags, focus, credit, license, source_url, license_expires, taken_at, uploaded_at, trashed_at, rev, placeholder, color
FROM media;
DROP TABLE media;
ALTER TABLE __new_media RENAME TO media;
CREATE INDEX media_sha256 ON media (sha256);
CREATE TABLE __new_media_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_key TEXT NOT NULL,
  at TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  reason TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  copy_key TEXT
);
INSERT INTO __new_media_revisions (id, media_key, at, bytes, width, height, reason, sha256, copy_key)
SELECT id, media_key, at, bytes, width, height, reason, coalesce(sha256, ''), backup_key FROM media_revisions;
DROP TABLE media_revisions;
ALTER TABLE __new_media_revisions RENAME TO media_revisions;
CREATE INDEX media_revisions_key ON media_revisions (media_key, id);
CREATE TABLE __new_media_changes (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  media_key TEXT NOT NULL
);
INSERT INTO __new_media_changes (seq, media_key) SELECT seq, media_key FROM media_changes;
DROP TABLE media_changes;
ALTER TABLE __new_media_changes RENAME TO media_changes;
CREATE TRIGGER media_changes_insert AFTER INSERT ON media BEGIN
  INSERT INTO media_changes (media_key) VALUES (NEW.key);
END;
CREATE TRIGGER media_changes_update AFTER UPDATE ON media BEGIN
  INSERT INTO media_changes (media_key) VALUES (NEW.key);
END;
CREATE TRIGGER media_changes_delete AFTER DELETE ON media BEGIN
  INSERT INTO media_changes (media_key) VALUES (OLD.key);
END;
