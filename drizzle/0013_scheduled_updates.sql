-- Scheduled updates to live articles (site-api v0.10.0): one pending revision per article, keyed by its slug (Carrel's
-- content id), applied by the one-minute cron (workers/app.ts). This is @dustinedwards/site-api/schedules'
-- SCHEDULED_UPDATES_SQL as written; publish_at is UTC ISO text, so the due scan is a text comparison on its index.
CREATE TABLE IF NOT EXISTS scheduled_updates (
  content_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  publish_at TEXT NOT NULL,
  change_id TEXT NOT NULL,
  scheduled_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS scheduled_updates_due ON scheduled_updates (publish_at);
