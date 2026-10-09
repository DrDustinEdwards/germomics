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

## Backup: nightly d1-dump into R2

`wrangler d1 export` fails on the two FTS5 tables, so the Worker's scheduled handler (03:17 UTC, `wrangler.jsonc` `triggers.crons`) runs `runBackup` in `app/lib/backup.server.ts`. It uses `@dustinedwards/d1-dump` to write one JSON object per table to the `BACKUPS` R2 bucket (`germomics-backups`) under `backups/json/<run id>/`, checks it, and only then writes `_complete.json`. It keeps 90 days and always the 14 newest complete runs.

- `session` and `verification` are excluded (live credentials and one-time tokens; restoring them would revive old sessions). The list is `BACKUP_EXCLUDE` in `app/lib/backup-checks.ts`; when Better Auth's tables are dropped, remove them there in the same change.
- A dump is left without its marker, and the run fails, if a content table (`posts`, `content_blocks`, `settings`, `show_config`) differs from its live count, a credential table is present, or everything is empty.
- `/health` reports `backup: { last_ok, age_hours, warning? }`; it warns past 26 hours.
- Restore and the drill: the d1-dump README ("Restore" and "Restore drill"). Download a run with `npx wrangler r2 object get germomics-backups/backups/json/<run id>/<file> --remote`, then `npx d1-dump drill --dir <dir>` (needs a Cloudflare API token that can create and delete D1 databases; Node 24).

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
