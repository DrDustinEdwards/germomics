-- contract: hand-run; columns, an index and settings rows nothing reads or writes. Counts and readers in the 2026-11-24 database audit.
-- subscribers.confirmed_at repeated consented_at (confirm() wrote one value to both), so consented_at is now the one confirmation time.
-- Rows 0027 backfilled from created_at keep that time: consented_at takes confirmed_at wherever it was empty.
UPDATE subscribers SET consented_at = confirmed_at WHERE consented_at IS NULL AND confirmed_at IS NOT NULL;
ALTER TABLE subscribers DROP COLUMN confirmed_at;
ALTER TABLE posts DROP COLUMN key_moments;
ALTER TABLE settings DROP COLUMN "group";
ALTER TABLE content_blocks DROP COLUMN description;
-- media_captions: empty, nothing writes it, its one reader was the finished backfill (Dustin's yes, 2026-11-24)
DROP TABLE IF EXISTS media_captions;
-- covered by episode_people_uniq (post_id, person_id)
DROP INDEX IF EXISTS episode_people_post_idx;
DELETE FROM settings WHERE key IN ('site.tagline', 'site.base_url', 'ratelimit.ai', 'ratelimit.auth')
  OR key LIKE 'ai.prompt.%';
