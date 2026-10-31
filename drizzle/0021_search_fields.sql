-- site-api's search fields canonical and noindex for posts (searchTitle, description, image and imageAlt are the
-- existing seo_title, seo_description, og_image and og_image_alt). Hand-written (drizzle-kit is not used), kept in step
-- with app/db/schema.ts (test/schema.test.ts). Applied with:
--   wrangler d1 migrations apply germomics [--local|--remote]
--
-- ADDITIVE: two columns; no existing row is touched. A post keeps its own address and stays indexed until set.
ALTER TABLE posts ADD COLUMN canonical TEXT;
ALTER TABLE posts ADD COLUMN noindex INTEGER NOT NULL DEFAULT 0;
