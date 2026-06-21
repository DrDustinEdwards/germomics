-- Local-only seed for dev/verification (NOT a migration). Apply with:
--   npx wrangler d1 execute germomics --local --file scripts/seed.local.sql
DELETE FROM posts;
DELETE FROM show_config;

INSERT INTO show_config
  (title, description, author, owner_email, artwork, apple_category, language, itunes_type, explicit, subscribe_links, funding_url)
VALUES
  ('germomics', 'A podcast about microbiology and history — the purple stain, retold.',
   'Dustin Edwards', 'emaildustinedwards@gmail.com', 'https://images.germomics.com/cover.jpg',
   'Science', 'en-us', 'episodic', 0,
   '{"Apple Podcasts":"https://podcasts.apple.com/","Spotify":"https://open.spotify.com/"}', NULL);

INSERT INTO posts
  (kind, title, slug, body, excerpt, status, featured, published_at,
   audio_url, audio_duration, audio_byte_size, audio_mime_type,
   episode_number, season_number, episode_type, explicit, guid, transcript, chapters, guests, tags)
VALUES
  ('episode', 'The Purple Stain', 'the-purple-stain',
   '<p>How Gram''s stain split the bacterial world in two.</p>',
   'How a single violet dye divided all bacteria.', 'published', 1, '2026-06-15T12:00:00.000Z',
   'https://media.germomics.com/episodes/1/the-purple-stain.mp3', 1834, 29344000, 'audio/mpeg',
   1, 1, 'full', 0, 'urn:germomics:11111111-1111-1111-1111-111111111111',
   '[00:00] Welcome to germomics.' || char(10) || '[00:42] Hans Christian Gram and the violet dye.' || char(10) || '[05:10] Why some cells keep the stain.',
   '[{"start":0,"title":"Intro"},{"start":42,"title":"Gram''s discovery"},{"start":310,"title":"The cell wall"}]',
   '[{"name":"Dr. Vera Lin","role":"Microbiologist","bio":"Studies the bacterial cell envelope."}]',
   '["gram-stain","history","bacteria"]');

INSERT INTO posts
  (kind, title, slug, body, excerpt, status, featured, published_at, tags)
VALUES
  ('article', 'Notes on the Broad Street Pump', 'broad-street-pump',
   '<p>John Snow, cholera, and the birth of epidemiology.</p>',
   'The map that started epidemiology.', 'published', 0, '2026-06-10T09:00:00.000Z',
   '["cholera","history","epidemiology"]');
