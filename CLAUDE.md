# CLAUDE.md - germomics

germomics.com: a podcast and writing site about microbiology and history, with interactive data pages (viruses and bacteria) and arcade browser games. Single author, single admin. The canonical spec is `docs/germomics_build_plan.html`: this file is the how, the build plan is the what and why.

## Rules that come first

- Tests: keep the minimal set (a few browser tests for flows that must never break, one integration test per real behavior, unit tests only for tricky logic, shared code tested once where it lives), and remove any test that pins design, repeats coverage or has never caught a real mistake, unless it guards a harm that cannot be undone.
- Read `germomics/core.md` in Capsid with this file. Before writing anything another site might have, read what the sites share: https://github.com/DrDustinEdwards/devkit/blob/shared-list/SHARED.md (CI's shared-code check fails on a copy).
- germomics is the best-designed site in the family (Dustin, 2026-10-04). It will move onto Capsomer carefully, in its own design job that starts with a study and baseline screenshots; until then, do not change its look casually, and do not treat it as unchangeable either.

## Stack

React Router 8 (framework mode) and React 19 on Workers with @cloudflare/vite-plugin; D1 with Drizzle; R2 for audio and images, with resized AVIF and WebP copies made on request by the Images binding at germomics.com/media (`app/lib/images.ts`; stored URLs stay the originals at images.germomics.com), and each image's alt, caption, tags, credit, trash state and byte history in D1 `media` (Carrel's media library, `app/lib/carrel/media.server.ts`); Workers AI (binding `AI`) for that library's suggested alt text and tags, under the AI daily cap; KV for the AI cap; Cloudflare Access (application germomics-login) in front of /admin, verified by `@dustinedwards/site-runtime/access`; Tailwind v4 with the germomics palette as tokens (until the Capsomer move); lucide-react; the writing (every post field and the content pages) is written in Carrel, the only editor, through site-api (`app/lib/carrel`, with its D1 store for retries, preview links and webmentions), the admin keeping only an episode's audio and transcript (`/admin/episodes`); bodies are Markdown rendered by Prelum's pipeline into stored HTML (`app/lib/render.server.ts`); Google Maps on the data pages; Recharts for charts (moving to Enarratio in the Capsomer move); Phaser 4 for games.

## Commands

- `npm run typecheck` (wrangler types, typegen, tsc -b) and `npm test`: the quick local checks.
- `npm run dev`: Vite in workerd with bindings.
- `npm run db:migrate` (local) and `db:migrate:prod` (remote).
- Deploys: Cloudflare Workers Builds deploys on every push to `main`. A merge to `main` is a production deploy. `npm run deploy` deploys by hand.

## Backup: nightly d1-dump into R2

`wrangler d1 export` fails on the two FTS5 tables, so the Worker's scheduled handler (03:17 UTC, `wrangler.jsonc` `triggers.crons`; its other cron, every minute, applies the updates Carrel scheduled on live articles) runs its jobs through site-runtime's `runJobs`, each isolated and recorded in D1 `cron_runs`. Nightly, `runBackup` in `app/lib/backup.server.ts`: `@dustinedwards/d1-dump`'s `runCheckedBackup` writes one JSON object per table to the `BACKUPS` R2 bucket (`germomics-backups`) under `backups/json/<run id>/`, runs the standard checks with germomics' lists (`app/lib/backup-checks.ts`), and only then writes `_complete.json`. Then d1-dump's `backupFiles` copies the audio (`MEDIA`) and images (`BLOG_IMAGES`) under `files/audio/` and `files/images/`, each run going on where the last stopped, and the 404 counts are pruned to 90 days. Retention is d1-dump's default: the newest complete run of each of the last 14 days, 8 weeks and 6 months (about 25 runs, six months back).

- `session`, `verification` and `account` (Better Auth's credential tables, dropped by `drizzle/0010_retire_better_auth.sql`) never go into a dump: live credentials, one-time tokens and OAuth tokens, and restoring sessions would revive old sign-ins. Nor does `preview_links` (site-api's preview link hashes), whose restore would revive revoked links. The list is `BACKUP_EXCLUDE` in `app/lib/backup-checks.ts`. A run excludes only the ones that exist at that moment (d1-dump fails on an excluded name that is not a table), so it passes before and after the migration.
- A dump is left without its marker, and the run fails, if a content table (`posts`, `content_blocks`, `settings`, `show_config`) differs from its live count, a credential table is present, or everything is empty.
- `/health` reports `backup: { last_ok, age_hours, warning?, files }`; it warns past 26 hours for the dump or either file pass, and its `cron` check warns on a job that failed or stopped.
- Restore and the drill: the d1-dump README ("Restore" and "Restore drill"). Download a run with `npx wrangler r2 object get germomics-backups/backups/json/<run id>/<file> --remote`, then `npx d1-dump drill --dir <dir>` (Node 24). `.github/workflows/restore-drill.yml` drills the newest dump weekly, straight from the bucket (a token with R2 read only).

## Hard rules

A rule stays here only if it stops a real, costly mistake that nothing else catches. Earlier rulings are in the version history of Capsid `germomics/decisions.md` (retired 2026-10-29).

1. The podcast feed lives at `/feed/podcast/` and that URL never changes. Episode `guid` values never change once published. Feeds are resource routes returning a raw Response with the right Content-Type.
2. Migrations are hand-written additive SQL in `drizzle/`, kept in sync with `app/db/schema.ts`, applied with wrangler; drizzle-kit is not used. Search uses the FTS5 tables. No hand-written SQL in route code; use the query builder.
3. The audio player is the highest-risk accessibility component: full keyboard support, seeking without dragging, correct name, role and state on every control. Every episode has a transcript.
4. Heavy client libraries (maps, charts, Phaser) are lazy-loaded per route and never reach the server bundle or the shared client chunk. Phaser loads only on `/games/:slug`.
5. Every public read (lists, detail, search, feed, sitemap) goes through `publiclyVisible()`, or a scheduled post leaks before its publish_at.
6. AI output is drafts only: the AI endpoint never writes the database and the API key never reaches the client.
7. The /about bio states only confirmed facts; an unconfirmed item renders as a marked editor note, never as a claim. /privacy and /terms are drafts until a lawyer reviews them.
8. Content is read straight from D1 with no KV cache in front, so a write shows on the next read; the Worker is placed next to D1 (`placement` in wrangler.jsonc) to keep that fast.
