-- A caption per image in BLOG_IMAGES (site-api v0.10.0, Carrel's caption tool), keyed by the R2 key. It lives here,
-- not in the object's custom metadata, because a caption may be up to 2,000 characters and R2 allows 2 KB of metadata
-- in all. An image with no row has no caption.
CREATE TABLE IF NOT EXISTS media_captions (
  media_key TEXT PRIMARY KEY,
  caption TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
