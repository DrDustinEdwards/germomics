# CLAUDE.md - germomics

germomics.com: a podcast and writing site about microbiology and history, with interactive data pages (viruses and bacteria) and arcade browser games. Single author, single admin. The canonical spec is `germomics_build_plan.html`: this file is the how, the build plan is the what and why.

## Rules that come first

- The portfolio rules are in Capsid: `capsid/conventions.md`. Read it with this file and `germomics/core.md`. Where they disagree, conventions wins. Rulings for this site go in `germomics/decisions.md`.
- germomics is the best-designed site in the family (Dustin, 2026-10-04). It will move onto Capsomer carefully, in its own design job that starts with a study and baseline screenshots; until then, do not change its look casually, and do not treat it as unchangeable either.

## Stack

React Router 8 (framework mode) and React 19 on Workers with @cloudflare/vite-plugin; D1 with Drizzle; R2 for audio and images; KV for sessions; Better Auth (Google sign-in, one allowlisted admin); Tailwind v4 with the germomics palette as tokens (until the Capsomer move); lucide-react; Tiptap for the editor; Google Maps on the data pages; Recharts for charts (moving to Enarratio in the Capsomer move); Phaser 4 for games.

## Commands

- `npm run typecheck` (wrangler types, typegen, tsc -b) and `npm test`: the quick local checks.
- `npm run dev`: Vite in workerd with bindings. `npm run typegen` after any binding change.
- `npm run db:migrate` (local) and `db:migrate:prod` (remote).
- Deploys: Cloudflare Workers Builds deploys on every push to `main`. A merge to `main` is a production deploy. `npm run deploy` deploys by hand.

## Backup: the whole-database export does not work here

`npx wrangler d1 export germomics` fails on the two FTS5 tables. Export per table, data only, the irreplaceable content first:

```
npx wrangler d1 export germomics --remote --no-schema --table posts --output export-posts.sql
npx wrangler d1 export germomics --remote --no-schema --table content_blocks --output export-content_blocks.sql
npx wrangler d1 export germomics --remote --no-schema --table settings --output export-settings.sql
npx wrangler d1 export germomics --remote --no-schema --table show_config --output export-show_config.sql
```

Check counts on the other tables rather than trusting a list; Better Auth's tables regenerate on login. Never export `posts_fts`, `content_blocks_fts` or any FTS shadow table. Restore: apply `drizzle/` migrations, then the data files, then rebuild the indexes (`INSERT INTO posts_fts (posts_fts) VALUES ('rebuild');` and the same for `content_blocks_fts`). Check each export file actually contains INSERT rows. Full version: `germomics/protocol-backup.md` in Capsid. A nightly per-table backup job (d1-dump) is queued to replace this by hand.

## Hard rules

1. The podcast feed lives at `/feed/podcast/` and that URL never changes. Episode `guid` values never change once published. Feeds are resource routes returning a raw Response with the right Content-Type.
2. Migrations are hand-written additive SQL in `drizzle/`, kept in sync with `app/db/schema.ts`, applied with wrangler; drizzle-kit is not used. Search uses the FTS5 tables. No hand-written SQL in route code; use the query builder.
3. The audio player is the highest-risk accessibility component: full keyboard support, seeking without dragging, correct name, role and state on every control. Every episode has a transcript.
4. Heavy client libraries (maps, charts, Phaser) are lazy-loaded per route and never reach the server bundle or the shared client chunk. Phaser loads only on `/games/:slug`.
5. The site's writing-style rule is in every generator prompt in `app/lib/ai.server.ts` (`STYLE_RULE`). Keep it in step with the portfolio writing rules; it also covers the generated robots.txt, llms.txt and ai.txt.

## Content model

Column-level detail loads from `.claude/rules/content-model.md` when working under `app/db/` or the post routes.

## Done means

Typecheck clean, server and client separated (`.server` only on the server), accessible (keyboard, names and roles), works against local D1 and a preview deploy, and the worker bundle does not grow without reason.
