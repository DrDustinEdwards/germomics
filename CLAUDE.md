# CLAUDE.md - germomics

Portfolio-wide rules live in Capsid, not here. Read `capsid/conventions.md` first, then `germomics/core.md`. This file holds only what is true of this repo.

## What this is

germomics.com: a podcast and writing site about microbiology and history, plus interactive data pages (viruses and bacteria) and arcade browser games. Single author, single admin. The canonical spec is `germomics_build_plan.html` (kept in the project). This file is the how; the build plan is the what and the why.

## Session ritual

Start: read `capsid/conventions.md`, then `germomics/core.md`.
End: write a `session-YYYY-MM-DD.md` episodic (type `episodic`, under ~2KB) to the germomics namespace. Decisions go to `germomics/decisions.md`.

## Stack (repo-specific additions to the house stack)

- React Router v7 (framework mode) + React 19 + TypeScript, Vite with @cloudflare/vite-plugin. Dev server runs in workerd.
- D1 via Drizzle, R2 for audio and images, KV for sessions. Better Auth (Google sign-in, single allowlisted admin).
- Tailwind v4 with the germomics palette wired as design tokens. lucide-react.

## Commands

- `npm run dev` - Vite dev server in workerd, bindings available locally
- `npm run build` - production build (client + server)
- `npm run deploy` - wrangler deploy (Workers Builds runs this in CI on push)
- `npm run typegen` - regenerate worker-configuration.d.ts after any binding change
- `npm run db:migrate` / `db:migrate:prod`
- `npm run auth:generate` - regenerate Better Auth tables after changing auth config

## Backup: the whole-database export does not work here

`npx wrangler d1 export germomics` FAILS: `D1 Export error: cannot export databases with Virtual Tables (fts5)`, exit 1, no file written. This database has two FTS5 virtual tables, so the one command anyone reaches for in a recovery is not available, and episode and post prose has no second copy in git. Export per table, data only:

```
npx wrangler d1 export germomics --remote --no-schema --table posts --output export-posts.sql
npx wrangler d1 export germomics --remote --no-schema --table content_blocks --output export-content_blocks.sql
npx wrangler d1 export germomics --remote --no-schema --table settings --output export-settings.sql
npx wrangler d1 export germomics --remote --no-schema --table show_config --output export-show_config.sql
```

Those four carry the irreplaceable content. `post_versions`, `people`, `episode_people`, `soundbites`, `subscribers` and `scores` were empty as of 2026-08-17: check counts rather than trusting that, because an empty table today is a populated table after the next feature lands. `user`, `account`, `session` and `verification` are Better Auth's and regenerate on next login. `d1_migrations` is rebuilt by running migrations, and `_cf_KV` and `sqlite_sequence` are internals.

**Never export** `posts_fts`, `content_blocks_fts`, or any `_config`, `_data`, `_docsize` or `_idx` shadow table. They are derived data, they are what makes the whole-database export fail, and restoring them corrupts the index.

Restore in order: apply the `drizzle/` migrations first, since the exports were taken with `--no-schema` and carry no schema; then the per-table data files; then rebuild the search index.

```
INSERT INTO posts_fts (posts_fts) VALUES ('rebuild');
INSERT INTO content_blocks_fts (content_blocks_fts) VALUES ('rebuild');
```

**Check that each export file actually contains INSERT rows.** An empty export still writes a file and still exits 0, so a "the file exists" check passes over nothing.

Full version, with row counts and the two FTS5 traps that make a naive integrity check useless: Capsid namespace `germomics`, path `protocol-backup.md`.

## Hard rules

1. The podcast feed path is sacred. It is served at `/feed/podcast/` and that URL never changes. Episode `guid` values are immutable once published. Both are how every podcast directory keeps finding the show. Feeds are resource routes (a `loader` returning a raw `Response` with the right `Content-Type`), not React pages.
2. Migrations are hand-authored additive SQL in `drizzle/`, kept in sync with `app/db/schema.ts`, applied with wrangler. drizzle-kit is not used. Full text search uses the existing FTS5 virtual table. Do not hand-write SQL in route code; use the query builder.
3. Design system is locked. Anchor color `#4F2D7F` (crystal violet). Cyan (`#0E7490` light, `#22D3EE` dark) is reserved for interactive and now-playing states only. Fonts: a grotesk for display/UI, Fraunces for body, JetBrains Mono for timestamps and numbers. Do not introduce new colors or fonts without updating the build plan first.
4. The audio player is the highest-risk accessibility component: full keyboard support, a seek control that works without dragging, correct name/role/state on every control. Transcripts are required on every episode.
5. Keep the worker lean. Heavy client libraries (MapLibre for maps, Recharts for charts, Phaser 4 for games) are `lazy()`-imported and code-split per route. They must never end up in the server bundle or the shared client chunk. Phaser's ~500KB only ever loads on an individual `/games/:slug` route.
6. The site style rule is baked into every generator prompt in `app/lib/ai.server.ts` (`STYLE_RULE`, appended to the shared system prompt). If the canon's writing style changes, keep the two in sync. Scope of "site copy" includes the generated `robots.txt` / `llms.txt` / `ai.txt`.

## Content model

Column-level detail loads on demand from `.claude/rules/content-model.md` when working under `app/db/` or the post routes.

## Definition of done

Type-checks clean, server/client boundary respected (`.server` only on the server), accessible (keyboard + names/roles), works against local D1 and against a preview deploy, does not regress the worker bundle size.
