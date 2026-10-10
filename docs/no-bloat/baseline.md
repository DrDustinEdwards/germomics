# No-bloat baseline (phase 0)

Ruling: capsid/decisions.md "no bloat, as a standing plan" (Dustin, 2026-10-01). Capsid job
job_64eb25627861. Nothing was removed in this phase; removal happens in the adoption and cleanup
phases, in Capsomer's order.

- Measured at commit `475439c88f4fc2b7ebbe11a8b71f2dd25934e36a` (main at `93edd2d` plus the
  tooling commit only: knip.jsonc, .jscpd.json, scripts/nobloat.mjs, the two dev dependencies and
  the CI steps; no app code changed).
- Date: 2026-10-09. Node 22.22.0, Knip 6.39.0, jscpd 5.4.0, Vite 8 production build.
- The machine-readable numbers CI compares against are in `docs/no-bloat/baseline.json`.

## Commands

```sh
npm ci
npm run nobloat:knip      # react-router typegen, then knip --reporter json > .nobloat/knip.json
npm run nobloat:jscpd     # jscpd with .jscpd.json, report in .nobloat/jscpd/
npm run build
npm run nobloat:weight    # reads build/client's React Router manifest, gzip -9 per asset
npm run nobloat:baseline  # all of the above, then rewrites docs/no-bloat/baseline.json
```

Refreshing the baseline is a deliberate act: run `npm run nobloat:baseline` on a clean checkout,
update this file's numbers and commit both in the same PR.

## Knip

Entry points come from Knip's own plugins, which enable themselves from package.json:
react-router (app/routes.ts and every route file it names, app/root.tsx, app/entry.server.tsx),
wrangler (wrangler.jsonc `main`, workers/app.ts), vite and vitest (test/**/*.test.ts). The plugin
sources were read in node_modules/knip/dist/plugins to confirm this. `knip.jsonc` adds only what no
plugin can know: the hand-run scripts in `scripts/` as entries, and `cloudflare` ignored as a
dependency, because `cloudflare:test` is the workers pool's virtual module. Route files import
`./+types/*`, so typegen runs first; without it Knip reports 46 false unresolved imports.

| Issue type | Count |
|---|--:|
| Unused files | 0 |
| Unused dependencies | 0 |
| Unused devDependencies | 0 |
| Unlisted dependencies | 0 |
| Unresolved imports | 0 |
| Unused exports | 27 |
| Unused exported types | 2 |

Unused exports: `usePrefersReducedMotion` (components/content/EpisodeExtras.tsx),
`LEGAL_LAST_UPDATED` (components/content/Legal.tsx), `SPEEDS`, `SLEEP_OPTIONS`
(components/player/controls.tsx), `schema` (db/index.server.ts), `STYLE_RULE` (lib/ai.server.ts),
`BACKUP_COUNTED_TABLES` (lib/backup-checks.ts), `bustContentCache` (lib/content.server.ts),
`getExecutionCtx` (lib/context.server.ts), `FRESH_SECONDS`, `SWR_SECONDS`
(lib/edge-cache.server.ts), `secondsToStamp` (lib/format.ts), `getPerson` (lib/people.server.ts),
`publiclyVisible`, `isVisibleNow` (lib/posts.server.ts), `MEDIA_BASE`, `IMAGE_BASE`, `mediaUrl`,
`imageUrl` (lib/r2.server.ts), `op3Enclosure` (lib/rss.server.ts), `sanitizeName`
(lib/scores.server.ts), `headingId` (lib/seo.ts), `DEFAULT_SHOW` (lib/show.server.ts),
`SITE_ADDRESS` (lib/site.ts), `THEME_KEY`, `storedTheme`, `systemTheme` (lib/theme.ts).
Unused exported types: `Db` (db/index.server.ts), `SubTier` (lib/subscribe.ts).

Most of these are exported but used only inside their own file, so the cleanup is usually
dropping `export`, not deleting code. Two things Knip cannot see, for whoever does the cleanup:
the improve loop's hidden holdout suite imports app/lib/format.ts and app/lib/r2.server.ts
(vitest.config.ts says so), so `secondsToStamp`, `MEDIA_BASE`, `IMAGE_BASE`, `mediaUrl` and
`imageUrl` may be used there; and CLAUDE.md hard rule 5 names `STYLE_RULE` by its export.

Before the config, the default run also listed 16 scripts as unused files and `sharp` and
`audio-decode` as unused devDependencies; all of those are used by the hand-run scripts, which
are now entries.

## jscpd

Scope: tracked TypeScript, TSX, JavaScript and CSS from the repo root, excluding node_modules,
build output, .react-router, scripts/_generated, worker-configuration.d.ts, public, docs,
research, improve, drizzle and .claude. Default detection (exact clones, 50 tokens, 5 lines).

| Format | Files | Lines | Clones | Duplicated lines | Duplication |
|---|--:|--:|--:|--:|--:|
| CSS | 3 | 407 | 34 | 231 | 56.76% |
| JavaScript | 16 | 2,433 | 1 | 8 | 0.33% |
| TSX | 82 | 9,866 | 22 | 211 | 2.14% |
| TypeScript | 71 | 5,307 | 9 | 67 | 1.26% |
| Total | 172 | 18,013 | 66 | 517 | 2.87% (4.44% of tokens) |

Largest pairs by duplicated lines: app/admin.css and app/fonts.css (102, the self-hosted
`@font-face` blocks), app/fonts.css with itself (77), app/admin.css with itself (40),
archive.tsx and search.tsx (27), HostsEditor.tsx and SourcesEditor.tsx (18), contact.tsx and
privacy.tsx (17), scripts/import-episodes.ts and import-show-config.ts (17), CopyLink.tsx and
ShareTimestamp.tsx (16).

## Page weight

Per page route, the JavaScript and CSS a first view loads: the client entry and its imports plus
the module, imports and CSS of every route from root to the leaf, each file counted once, read
from React Router's client manifest and gzipped at level 9. Not counted: HTML, fonts, images,
and third-party scripts (Google Maps loads from Google). Resource routes (feeds, robots.txt,
health) load no client code and are not listed.

Shared JS on every page (entry and root): 124.7 KB gzip.

| Route | JS | CSS | Total |
|---|--:|--:|--:|
| `/` | 131.1 KB | 9.6 KB | 140.7 KB |
| `/:slug` | 141.5 KB | 9.6 KB | 151.1 KB |
| `/about` | 130.3 KB | 9.6 KB | 139.9 KB |
| `/about/dustin-edwards` | 129.4 KB | 9.6 KB | 139.0 KB |
| `/archive` | 127.5 KB | 9.6 KB | 137.1 KB |
| `/contact` | 127.6 KB | 9.6 KB | 137.2 KB |
| `/data` | 125.7 KB | 9.6 KB | 135.3 KB |
| `/data/:slug` | 125.9 KB | 9.6 KB | 135.5 KB |
| `/episodes` | 127.1 KB | 9.6 KB | 136.7 KB |
| `/games` | 125.7 KB | 9.6 KB | 135.4 KB |
| `/games/:slug` | 126.5 KB | 9.6 KB | 136.1 KB |
| `/guests/:guest` | 127.1 KB | 9.6 KB | 136.7 KB |
| `/preview/:id/:token` | 141.2 KB | 9.6 KB | 150.8 KB |
| `/privacy` | 128.3 KB | 9.6 KB | 137.9 KB |
| `/search` | 127.4 KB | 9.6 KB | 137.1 KB |
| `/season/:num` | 128.7 KB | 9.6 KB | 138.4 KB |
| `/subscribe` | 126.9 KB | 9.6 KB | 136.5 KB |
| `/tag/:tag` | 126.9 KB | 9.6 KB | 136.5 KB |
| `/terms` | 128.3 KB | 9.6 KB | 137.9 KB |
| `/txasm` | 127.9 KB | 9.6 KB | 137.6 KB |
| `/unsubscribe` | 125.4 KB | 9.6 KB | 135.0 KB |
| `/writing` | 125.9 KB | 9.6 KB | 135.5 KB |
| `/admin` | 134.0 KB | 16.7 KB | 150.7 KB |
| `/admin/content/:key` | 134.9 KB | 16.7 KB | 151.6 KB |
| `/admin/people` | 138.4 KB | 16.7 KB | 155.0 KB |
| `/admin/posts` | 136.7 KB | 16.7 KB | 153.4 KB |
| `/admin/posts/:id` | 153.9 KB | 16.7 KB | 170.6 KB |
| `/admin/settings` | 138.4 KB | 16.7 KB | 155.1 KB |
| `/admin/soundbites` | 135.3 KB | 16.7 KB | 151.9 KB |
| `/admin/subscribers` | 134.7 KB | 16.7 KB | 151.3 KB |

Lazy chunks (no page loads them on first view): PhaserGame.client 347.1 KB, TipTapBody 103.0 KB,
DataChart.client (Recharts) 96.1 KB, DataMap.client 2.0 KB, EpisodeWaveform 1.0 KB, all gzip.
Phaser, Recharts and the map loader are all outside the shared chunk, as hard rule 4 requires.

Worker bundle (build/server JS and CSS): 2,292.2 KB raw, 514.8 KB gzip. The largest pieces are
server-build (1,043.6 KB raw), TipTapBody (682.8 KB raw) and backup.server (394.5 KB raw, the
d1-dump library).

Real-speed check: this repo has none (no Lighthouse or field-speed job), so there is no number
to record.

## Lines of code and dependencies

Non-blank lines in tracked files, excluding docs, research, public, improve, .claude and the
lockfile: TSX 9,247, TypeScript 4,854, JavaScript 2,241, SQL 389, CSS 371.

Dependencies: 18 direct, 17 dev (including the two this job added). Lockfile: 512 installed
packages, 123 of them production. Before this job: 448 installed, 123 production; Knip and jscpd
add 64 dev-only packages and nothing to production or the Worker.

## Clearly broken

Nothing. With the entry points configured, Knip reports no unresolved imports, no unlisted
dependencies and no missing packages.

## CI

The `verify` job in .github/workflows/ci.yml runs Knip, jscpd and the page-weight report after
its gate steps, each `continue-on-error`, and scripts/nobloat.mjs always exits 0. A number above
this baseline (any Knip count, the duplication percentage, a route or the Worker bundle more
than 512 bytes gzip over) becomes a warning annotation and a line in the job summary. Measured
locally, the three add about 8 seconds (Knip 6.7 s including typegen, jscpd 0.4 s, page weight
0.3 s), well under a minute of Actions time per run, because they reuse the job's install and
build.
