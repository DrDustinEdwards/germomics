-- 0003_feed_standards.sql — Tier 2 (Podcasting 2.0 feed tags + iTunes categories). ADDITIVE.
-- Only show_config gains columns; posts/episodes (the 10 GUIDs + enclosures) are untouched.

ALTER TABLE show_config ADD COLUMN categories TEXT DEFAULT '[]'; -- JSON [{category, subcategory?}]
ALTER TABLE show_config ADD COLUMN funding_label TEXT;           -- optional label for podcast:funding

-- Backfill the legacy three iTunes categories onto the single config row.
UPDATE show_config
SET categories = '[{"category":"Science","subcategory":"Life Sciences"},{"category":"Society & Culture","subcategory":"Documentary"},{"category":"Education","subcategory":"Courses"}]'
WHERE categories IS NULL OR categories = '' OR categories = '[]';
