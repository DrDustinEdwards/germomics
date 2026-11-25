# CLAUDE.md - germomics

germomics.com: a podcast and writing site about microbiology and history, with interactive data pages (viruses and bacteria) and arcade browser games. Single author, single admin. The canonical spec is `docs/germomics_build_plan.html`: this file is the how, the build plan is the what and why.

## Rules every repo shares

- **Tests.** Reproduce a reported failure before fixing it, and report red before and green after. Keep the minimal set: a few browser tests for flows that must never break, one integration test per real behavior, unit tests only for tricky logic, shared code tested once where it lives. Remove a test that pins design, repeats coverage or never caught a mistake, unless it guards a harm that cannot be undone.
- **UI copy.** Let the layout explain: no eyebrows, restating subtitles, "this page lets you" intros, hints a label already gives or empty-state essays. Labels, accessible names, errors, one-way warnings and legal text stay (Dustin, 2026-11-18; capsid/conventions.md).
- **Shared code.** Before writing anything another site might have, check https://github.com/DrDustinEdwards/devkit/blob/shared-list/SHARED.md. Change shared code in place and delete what the change replaces in the same PR.
- **Browser support.** devkit's docs/browser-support.md: Baseline Widely available freely, Newly available with a small fallback, Limited only feature-detected, no polyfills.
- **Secrets.** Never commit or print a key, token, `.dev.vars` or `.env`.
- **Deploys.** A merge to the default branch deploys; never deploy from a session.
- **D1.** Never hand-run production DDL; CI applies additive migrations and refuses the rest. Back up and restore with d1-dump, never `wrangler d1 export` (it fails on FTS5 tables).
- **Site copy and AI.** Copy describes only what the current build does. An AI provider key stays on the server, never in a client.

## Stack

- React Router 8 on Workers; D1 with Drizzle; R2 for audio and images; KV for the AI daily cap; Workers AI suggests alt text and tags in the media library; Phaser 4 for games; Enarratio draws the /data charts and the Soho map on the server (`app/lib/charts.server.ts`).
- Every picture is served from /media/<key> with AVIF and WebP sizes from the Images binding (`app/lib/images.ts`); its metadata is in D1 `media` (Carrel's media library).
- Carrel is the only editor of posts and pages, through site-api (`app/lib/carrel`); `/admin/episodes` keeps only audio and transcripts, behind Cloudflare Access. Bodies are Markdown rendered by Prelum into stored HTML (`app/lib/render.server.ts`).
- Public pages are plain CSS on Capsomer (app.css, site.css, prose.css); Tailwind v4 is in the admin only.

## Commands

- `npm run typecheck` (wrangler types, typegen, tsc -b), `npm run lint` (Oxlint, type-aware, devkit's shared config in `oxlint.config.ts`; after the typecheck) and `npm test`: the quick local checks.
- `npm run dev`: Vite in workerd with bindings.
- `npm run db:migrate` (local) and `db:migrate:prod` (remote).

## Backup

The nightly cron (`runBackup`, `app/lib/backup.server.ts`) dumps D1 with d1-dump and copies media into `germomics-backups`. `session`, `verification`, `account` and `preview_links` never go into a dump (`BACKUP_EXCLUDE`): restoring them would revive old sign-ins and revoked links.

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
