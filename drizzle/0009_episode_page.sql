-- 0009_episode_page.sql - editorial extras for the redesigned single-episode page. ADDITIVE.
-- Four nullable JSON/INTEGER columns; no data migration. 0000-0008 untouched.
--   posts.sources      JSON array of {type,title,url,authors,publisher,note,license}  (references + image credits)
--   posts.key_moments  JSON array of {seconds,label}  ("In this episode")
--   posts.reading_time INTEGER minutes, computed from body at save (restores the writing-card line)
--   show_config.hosts  JSON array of {name,role,img,href}  (co-host byline)

ALTER TABLE posts ADD COLUMN sources TEXT;
ALTER TABLE posts ADD COLUMN key_moments TEXT;
ALTER TABLE posts ADD COLUMN reading_time INTEGER;
ALTER TABLE show_config ADD COLUMN hosts TEXT;
