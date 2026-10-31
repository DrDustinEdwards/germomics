-- The writing moves from stored TipTap HTML to Markdown rendered by Prelum (Carrel is the editor). A post body and a
-- page's value become Markdown; beside each, the HTML Prelum rendered from it and the RENDER_VERSION it was rendered
-- with, so a public read serves the stored HTML and re-renders only when Prelum's output has moved
-- (app/lib/render.server.ts). Hand-written (drizzle-kit is not used), kept in step with app/db/schema.ts
-- (test/schema.test.ts). Applied with:
--   wrangler d1 migrations apply germomics [--local|--remote]
--
-- ADDITIVE: five nullable columns, no row touched. A row whose render_version is NULL has not been converted yet: its
-- body or value is still the sanitized HTML, and the site serves it as it did before. The data change that converts
-- the season 1 rows is applied by hand after its dry run, not here.
--
-- The FTS5 mirrors (posts_fts on title, body and excerpt; content_blocks_fts on title and value) and their triggers
-- are unchanged: they index the Markdown from then on, which holds the same words as the HTML did.

-- body_meta: Prelum's outline of the body as JSON, {"toc":[{depth,id,text}],"faq":[{question,answer}]}, so the
-- table of contents and the FAQ JSON-LD come from the stored render too.
ALTER TABLE posts ADD COLUMN body_html TEXT;
ALTER TABLE posts ADD COLUMN body_meta TEXT;
ALTER TABLE posts ADD COLUMN render_version TEXT;

ALTER TABLE content_blocks ADD COLUMN body_html TEXT;
ALTER TABLE content_blocks ADD COLUMN render_version TEXT;
