# CLAUDE.md - germomics

germomics.com: a podcast and writing site about microbiology and history, with interactive data pages (viruses and bacteria) and arcade browser games. Single author, single admin. The canonical spec is `docs/germomics_build_plan.html`: this file is the how, the build plan is the what and why.

## Rules that come first

- Tests: keep the minimal set (a few browser tests for flows that must never break, one integration test per real behaviour, unit tests only for tricky logic, shared code tested once where it lives), and remove any test that pins design, repeats coverage or has never caught a real mistake, unless it guards a harm that cannot be undone.
- Read `germomics/core.md` in Capsid with this file. Rulings for this site go in `germomics/decisions.md`.
- germomics is the best-designed site in the family (Dustin, 2026-10-04). It will move onto Capsomer carefully, in its own design job that starts with a study and baseline screenshots; until then, do not change its look casually, and do not treat it as unchangeable either.

## Stack

React Router 8 (framework mode) and React 19 on Workers with @cloudflare/vite-plugin; D1 with Drizzle; R2 for audio and images; KV for rate-limit counters, the AI cap and the content cache; Cloudflare Access (application germomics-login) in front of /admin, verified by `@dustinedwards/site-runtime/access`; Tailwind v4 with the germomics palette as tokens (until the Capsomer move); lucide-react; Tiptap for the editor; Google Maps on the data pages; Recharts for charts (moving to Enarratio in the Capsomer move); Phaser 4 for games.

## Commands

- `npm run typecheck` (wrangler types, typegen, tsc -b) and `npm test`: the quick local checks.
- `npm run dev`: Vite in workerd with bindings. `npm run typegen` after any binding change.
- `npm run db:migrate` (local) and `db:migrate:prod` (remote).
- Deploys: Cloudflare Workers Builds deploys on every push to `main`. A merge to `main` is a production deploy. `npm run deploy` deploys by hand.

## Backup: nightly d1-dump into R2

`wrangler d1 export` fails on the two FTS5 tables, so the Worker's scheduled handler (03:17 UTC, `wrangler.jsonc` `triggers.crons`) runs `runBackup` in `app/lib/backup.server.ts`: `@dustinedwards/d1-dump`'s `runCheckedBackup` writes one JSON object per table to the `BACKUPS` R2 bucket (`germomics-backups`) under `backups/json/<run id>/`, runs the standard checks and germomics' own (`app/lib/backup-checks.ts`), and only then writes `_complete.json`. Retention is d1-dump's default: the newest complete run of each of the last 14 days, 8 weeks and 6 months (about 25 runs, six months back).

- `session`, `verification` and `account` (Better Auth's credential tables, dropped by `drizzle/0010_retire_better_auth.sql`) never go into a dump: live credentials, one-time tokens and OAuth tokens, and restoring sessions would revive old sign-ins. The list is `BACKUP_EXCLUDE` in `app/lib/backup-checks.ts`. A run excludes only the ones that exist at that moment (d1-dump fails on an excluded name that is not a table), so it passes before and after the migration.
- A dump is left without its marker, and the run fails, if a content table (`posts`, `content_blocks`, `settings`, `show_config`) differs from its live count, a credential table is present, or everything is empty.
- `/health` reports `backup: { last_ok, age_hours, warning? }`; it warns past 26 hours.
- Restore and the drill: the d1-dump README ("Restore" and "Restore drill"). Download a run with `npx wrangler r2 object get germomics-backups/backups/json/<run id>/<file> --remote`, then `npx d1-dump drill --dir <dir>` (needs a Cloudflare API token that can create and delete D1 databases; Node 24).

## Hard rules

1. The podcast feed lives at `/feed/podcast/` and that URL never changes. Episode `guid` values never change once published. Feeds are resource routes returning a raw Response with the right Content-Type.
2. Migrations are hand-written additive SQL in `drizzle/`, kept in sync with `app/db/schema.ts`, applied with wrangler; drizzle-kit is not used. Search uses the FTS5 tables. No hand-written SQL in route code; use the query builder.
3. The audio player is the highest-risk accessibility component: full keyboard support, seeking without dragging, correct name, role and state on every control. Every episode has a transcript.
4. Heavy client libraries (maps, charts, Phaser) are lazy-loaded per route and never reach the server bundle or the shared client chunk. Phaser loads only on `/games/:slug`.
5. The site's writing-style rule is in every generator prompt in `app/lib/ai.server.ts` (`STYLE_RULE`). It also covers the generated robots.txt, llms.txt and ai.txt.

## Content model

Column-level detail loads from `.claude/rules/content-model.md` when working under `app/db/` or the post routes.
