-- Pictures through this origin, as dustinedwards.info serves its own: a stored image address becomes /media/<key>
-- (app/lib/images.ts) instead of the bucket's own address, https://images.germomics.com/<key>. The key after the
-- prefix is the same, so the same file answers. Feeds carry the new addresses from their next fetch.
-- Hand-written (drizzle-kit is not used). Applied with:
--   wrangler d1 migrations apply germomics [--local|--remote]
--
-- Rewrites addresses only, never words, in the post bodies and pages that hold one, and marks each render stale
-- (render_version '0'), so a read renders it again in memory and the nightly job stores it. updated_at is left alone:
-- no reader sees a post as changed. post_versions keeps its history as written. A restore is D1 Time Travel to the
-- bookmark the deploy takes before applying.
UPDATE posts
SET body = replace(body, 'https://images.germomics.com/', '/media/'),
    cover_image = replace(cover_image, 'https://images.germomics.com/', '/media/'),
    og_image = replace(og_image, 'https://images.germomics.com/', '/media/'),
    episode_artwork = replace(episode_artwork, 'https://images.germomics.com/', '/media/'),
    render_version = CASE WHEN render_version IS NULL THEN NULL ELSE '0' END
WHERE body LIKE '%https://images.germomics.com/%'
   OR cover_image LIKE 'https://images.germomics.com/%'
   OR og_image LIKE 'https://images.germomics.com/%'
   OR episode_artwork LIKE 'https://images.germomics.com/%';

UPDATE content_blocks
SET value = replace(value, 'https://images.germomics.com/', '/media/'),
    render_version = CASE WHEN render_version IS NULL THEN NULL ELSE '0' END
WHERE value LIKE '%https://images.germomics.com/%';

UPDATE people
SET photo = replace(photo, 'https://images.germomics.com/', '/media/')
WHERE photo LIKE 'https://images.germomics.com/%';

-- The show's artwork is read by podcast apps from the feed's itunes:image, which must be an absolute URL.
UPDATE show_config
SET artwork = replace(artwork, 'https://images.germomics.com/', 'https://germomics.com/media/')
WHERE artwork LIKE 'https://images.germomics.com/%';
