# CLAUDE.md - germomics

germomics.com: a podcast and writing site about microbiology and history. The spec is `docs/germomics_build_plan.html`.

## Rules every repo shares

- **Tests.** Reproduce a reported failure first: red before, green after. Keep the set minimal; delete a test that pins design or repeats coverage.
- **UI copy.** Let the layout explain: no eyebrows, restating subtitles, intros or hints a label already gives (Dustin, 2026-11-18).
- **Shared code.** Check devkit's [SHARED.md](https://github.com/DrDustinEdwards/devkit/blob/shared-list/SHARED.md) before writing anything another repo might have. Change shared code in place and delete what it replaces.
- **Secrets.** Never commit or print a key or token. AI provider keys stay on the server.
- **Production.** Never deploy, tag, release or run production DDL from a session; a merge deploys. Back up and restore D1 only with d1-dump.
- **Copy.** Site copy says only what the current build does.

## Rules for this repo

- **Podcast feed.** `/feed/podcast/` never changes, and an episode's `guid` never changes once published.
- **Scheduled posts.** Every public read (lists, detail, search, feed, sitemap) goes through `publiclyVisible()`, or a scheduled post leaks.
- **AI drafts.** AI output is drafts only: the AI endpoint never writes the database.
- **About and legal.** The /about bio states only confirmed facts. /privacy and /terms are drafts until a lawyer reviews them.
- **Backup.** `session`, `verification`, `account` and `preview_links` never go into a dump (`BACKUP_EXCLUDE`): restoring them would revive old sign-ins and revoked links.

## Commands

- `npm run typecheck`, then `npm run lint`, then `npm test`.
