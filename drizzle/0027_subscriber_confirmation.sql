-- Double opt-in for the newsletter (app/lib/newsletter.server.ts). A signup is pending until the person opens the signed
-- link mailed to the address: confirmed_at is when they confirmed, confirm_sent_at the time of the one link still
-- outstanding (part of the link's signed payload, cleared when it is used, so a link works once). Hand-written.
--
-- ADDITIVE: two nullable columns on subscribers. The one UPDATE backfills confirmed_at for the rows already there, so
-- the people on the list today stay on it as they were (pending would stop them receiving the newsletter).
ALTER TABLE subscribers ADD COLUMN confirmed_at TEXT;
ALTER TABLE subscribers ADD COLUMN confirm_sent_at TEXT;

UPDATE subscribers SET confirmed_at = COALESCE(consented_at, created_at) WHERE confirmed_at IS NULL;
