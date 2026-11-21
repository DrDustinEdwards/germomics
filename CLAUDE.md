# CLAUDE.md - germomics

germomics.com: a podcast and writing site about microbiology and history, with interactive data pages (viruses and bacteria) and arcade browser games. Single author, single admin. The canonical spec is `docs/germomics_build_plan.html`: this file is the how, the build plan is the what and why.

## Rules every repo shares

- **Tests.** Keep the minimal set (a few browser tests for flows that must never break, one integration test per real behavior, unit tests only for tricky logic, shared code tested once where it lives), and remove any test that pins design, repeats coverage or has never caught a real mistake, unless it guards a harm that cannot be undone.
- **UI copy.** Let the layout explain. No eyebrows, restating subtitles, "this page lets you" intros, descriptions under obvious buttons, hints a label already gives, repeated captions or empty-state essays; labels, accessible names, errors, one-way warnings and legal text stay (Dustin, 2026-11-18; Capsid capsid/conventions.md).
- **Shared code.** Before writing anything another site might have, read https://github.com/DrDustinEdwards/devkit/blob/shared-list/SHARED.md (CI's shared-code check fails on a copy). Change shared code in place and delete what a change replaces in the same PR.
- **Browser support.** devkit's docs/browser-support.md (Baseline Widely available freely; Newly available with a small fallback; Limited only feature-detected; no polyfills).
- **Secrets.** Never commit or print a key, token, `.dev.vars` or `.env`.
- **Reproduce first.** A report that something is broken names a cause; reproduce the failure before fixing it, and report red before and green after.
- **Deploys.** A merge to the default branch deploys (CI's deploy job); never deploy from a session.
- **D1.** Migrations are additive: CI applies the ones that only add and refuses a drop, rename or row delete for a hand run; never hand-run production DDL. `wrangler d1 export` fails on FTS5 tables, so back up and restore with d1-dump (its README); never export an `*_fts` table. Checking backups, backing up now and running a scheduled job now are Capsid Admin's, for every site (`/api/operator`, site-runtime `./operator`).
- **Site copy and AI.** Copy describes only what the current build does. An AI provider key stays on the server, never in a client.

## Rules for this repo

- Read `germomics/core.md` in Capsid with this file.
- germomics will move onto Capsomer carefully, in its own design job that starts with a study and baseline screenshots.

## Stack

React Router 8 (framework mode) and React 19 on Workers with @cloudflare/vite-plugin; D1 with Drizzle; R2 for audio and images, every picture served from germomics.com/media as on dustinedwards.info: the original, and resized AVIF and WebP copies made on request by the Images binding (`app/lib/images.ts`; a stored address is /media/<key>), and each image's alt, caption, tags, credit, trash state and byte history in D1 `media` (Carrel's media library, `app/lib/carrel/media.server.ts`); Workers AI (binding `AI`) for that library's suggested alt text and tags, under the AI daily cap; KV for the AI cap; Cloudflare Access (application germomics-login) in front of /admin, verified by `@dustinedwards/site-runtime/access`; Tailwind v4 in the admin only (the public pages are plain CSS on Capsomer: app.css, site.css, prose.css); the writing (every post field and the content pages) is written in Carrel, the only editor, through site-api (`app/lib/carrel`, with its D1 store for retries, preview links and webmentions), the admin keeping only an episode's audio and transcript (`/admin/episodes`); bodies are Markdown rendered by Prelum's pipeline into stored HTML (`app/lib/render.server.ts`); Enarratio for the /data charts and the Soho map (`enarratio/map`), drawn on the server (`app/lib/charts.server.ts`, themed from the site's own tokens); Phaser 4 for games.

## Commands

- `npm run typecheck` (wrangler types, typegen, tsc -b), `npm run lint` (Oxlint, type-aware, devkit's shared config in `oxlint.config.ts`; after the typecheck) and `npm test`: the quick local checks.
- `npm run dev`: Vite in workerd with bindings.
- `npm run db:migrate` (local) and `db:migrate:prod` (remote).

## Backup

The Worker's nightly cron (03:17 UTC; `runBackup` in `app/lib/backup.server.ts`) dumps D1 with d1-dump and copies the audio, images and game assets into `germomics-backups`. `session`, `verification`, `account` and `preview_links` never go into a dump (`BACKUP_EXCLUDE`, `app/lib/backup-checks.ts`): restoring them would revive old sign-ins and revoked links. `/health` warns past 26 hours. Germomics has no admin MCP server (retired 2026-11-07).

## Hard rules

A rule stays here only if it stops a real, costly mistake that nothing else catches.

1. The podcast feed lives at `/feed/podcast/` and that URL never changes. Episode `guid` values never change once published. Feeds are resource routes returning a raw Response with the right Content-Type.
2. Migrations are hand-written additive SQL in `drizzle/`, kept in sync with `app/db/schema.ts`; drizzle-kit is not used. Search uses the FTS5 tables. No hand-written SQL in route code; use the query builder.
3. The audio player is the highest-risk accessibility component: full keyboard support, seeking without dragging, correct name, role and state on every control. Every episode has a transcript.
4. Heavy client libraries (charts, Phaser) are lazy-loaded per route and never reach the server bundle or the shared client chunk. Phaser loads only on `/games/:slug`.
5. Every public read (lists, detail, search, feed, sitemap) goes through `publiclyVisible()`, or a scheduled post leaks before its publish_at.
6. AI output is drafts only: the AI endpoint never writes the database.
7. The /about bio states only confirmed facts; an unconfirmed item renders as a marked editor note, never as a claim. /privacy and /terms are drafts until a lawyer reviews them.
8. Content is read straight from D1 with no KV cache in front, so a write shows on the next read.
