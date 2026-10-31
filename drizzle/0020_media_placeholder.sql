-- Each media file's placeholder and main color (site-api v0.15.0's prepareUpload, the contract's MediaItem placeholder
-- and color): a tiny blurred WebP as a data: URI and #rrggbb, made at upload and again when the bytes change. Hand-written
-- (drizzle-kit is not used), kept in step with app/db/schema.ts (test/schema.test.ts). Applied with:
--   wrangler d1 migrations apply germomics [--local|--remote]
--
-- ADDITIVE: two nullable columns; no existing row is touched. Files stored before answer null until replaced.
ALTER TABLE media ADD COLUMN placeholder TEXT;
ALTER TABLE media ADD COLUMN color TEXT;
