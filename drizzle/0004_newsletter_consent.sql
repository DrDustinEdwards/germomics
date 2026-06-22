-- 0004_newsletter_consent.sql — H-D privacy. ADDITIVE.
-- Adds explicit-consent + tokenized one-click unsubscribe to the newsletter. Only the
-- `subscribers` table is touched; posts/episodes (the 10 GUIDs + enclosures) are untouched.

ALTER TABLE subscribers ADD COLUMN consented_at TEXT;       -- when the consent box was ticked
ALTER TABLE subscribers ADD COLUMN unsubscribe_token TEXT;  -- unguessable one-click token
ALTER TABLE subscribers ADD COLUMN unsubscribed_at TEXT;    -- suppression timestamp (NULL = active)

-- Backfill: existing subscribers submitted the email form themselves, so treat that as consent
-- (record it as their signup time), and mint an unsubscribe token so their one-click link works.
UPDATE subscribers SET consented_at = created_at WHERE consented_at IS NULL;
UPDATE subscribers SET unsubscribe_token = lower(hex(randomblob(16))) WHERE unsubscribe_token IS NULL;

-- Token is the lookup key for the unsubscribe route; enforce uniqueness (SQLite allows the
-- multiple NULLs that could only exist transiently before the backfill above).
CREATE UNIQUE INDEX IF NOT EXISTS subscribers_token_idx ON subscribers (unsubscribe_token);
