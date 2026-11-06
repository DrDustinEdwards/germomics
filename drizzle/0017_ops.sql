-- site-runtime's two operations tables, written and read only through it (declared in app/db/schema.ts to keep the two
-- in step, never queried through Drizzle). `cron_runs` is CRON_SQL from ./cron: each scheduled job's last start, success
-- and failure, which /health's cron check reads. `page_404_daily` is NOT_FOUND_SQL from ./not-found: the 404s the site
-- serves per path, referring host and UTC day, pruned to 90 days by the nightly job. Hand-written, applied with:
--   wrangler d1 migrations apply germomics [--local|--remote]
--
-- ADDITIVE: two new tables and one index; no existing row is touched.
CREATE TABLE IF NOT EXISTS cron_runs (
  name TEXT PRIMARY KEY NOT NULL,
  every_minutes INTEGER NOT NULL,
  first_started_at INTEGER,
  last_started_at INTEGER,
  last_ok_at INTEGER,
  last_failed_at INTEGER,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS page_404_daily (
  id TEXT PRIMARY KEY NOT NULL,
  day INTEGER NOT NULL,
  path TEXT NOT NULL,
  referrer_host TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'page',
  hit_count INTEGER DEFAULT 0 NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS page_404_daily_day_path_referrer_uq ON page_404_daily (day, path, referrer_host);
