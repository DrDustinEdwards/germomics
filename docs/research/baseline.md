# germomics baseline (job_f5acaeb4e003)

Measured 2026-10-10 at commit 166ff3b (main). Linux container, 4 cores, Node 22.22.0. Method follows
foxhound's `docs/research/baseline.md`. Nothing in the app changed and no test was deleted.

## Test suite

| What | Command | Result |
|------|---------|--------|
| Tests | `npx vitest run` | 9 files, 80 tests passed, 8.4 s in Vitest (11 s wall) |
| Pool | `vitest.config.ts` | `@cloudflare/vitest-pool-workers` (Miniflare), because `sanitize.server.ts` needs the Workers `HTMLRewriter` |

## Mutation testing (StrykerJS 9.6.1)

Installed per run with `npm i --no-save`; no package.json or lockfile edit. Config:
`stryker.config.mjs`. Setup: vitest runner, `coverageAnalysis: perTest`, `disableBail: true`,
`ignoreStatic: true`, concurrency 4. Mutated: `app/lib/**`, `app/db/**`, `workers/**` (43 files). Four chunks,
each pushed to the branch `results/germomics-mutation-baseline` (`chunks/`) when it finished:

| Chunk | Files | Run time |
|-------|-------|----------|
| db | `app/db/**` | 55 s |
| carrel | `app/lib/carrel/**`, `workers/**` | 4 min 10 s |
| content | posts, content, rss, sanitize, seo, discovery, vtt | 2 min 15 s |
| rest | every other `app/lib/*.ts` | 1 min 32 s |

No test file asserts on raw source text, so none had to be left out of the mutation run.

### Score

| Status | Mutants |
|--------|---------|
| Killed | 455 |
| Timeout | 0 |
| Survived | 239 |
| No coverage | 2,324 |
| Ignored (static) | 589 |
| Valid (killed + survived + no coverage) | 3,018 |

- **Mutation score: 15.08%** (455 of 3,018).
- Score over covered code: 65.56% (455 of 694).
- 77.0% of mutants have no covering test. The suite was written to make a dependency bump landable (see the
  header of `vitest.config.ts`), so it covers access, backup, Carrel, sanitizing, post rendering, map and the
  CSP only.
- Well covered: `backup.server.ts` 90%, `backup-checks.ts` 90%, `sanitize.server.ts` 80%, `access.server.ts` 78%,
  `map.ts` 100%. Weak or uncovered: `security.server.ts`, `posts.server.ts`, `rss.server.ts`, `edge-cache.server.ts`,
  `seo.ts` (11%), `vtt.ts` and `format.ts` (the hidden improve-loop suite covers those two, not this one).

### Per-file table

| File | Mutants | Killed | Survived | No coverage | Score |
|---|---|---|---|---|---|
| app/db/index.server.ts | 2 | 1 | 1 | 0 | 50.00% |
| app/db/schema.ts | 28 | 2 | 26 | 0 | 7.14% |
| app/lib/access.server.ts | 64 | 50 | 13 | 1 | 78.13% |
| app/lib/admin.server.ts | 39 | 7 | 0 | 32 | 17.95% |
| app/lib/ai.server.ts | 196 | 0 | 0 | 196 | 0.00% |
| app/lib/apple-categories.ts | 111 | 0 | 0 | 111 | 0.00% |
| app/lib/backup-checks.ts | 48 | 43 | 4 | 1 | 89.58% |
| app/lib/backup.server.ts | 20 | 18 | 1 | 1 | 90.00% |
| app/lib/carrel/adapter.server.ts | 280 | 155 | 89 | 36 | 55.36% |
| app/lib/carrel/handler.server.ts | 3 | 0 | 0 | 3 | 0.00% |
| app/lib/carrel/source.ts | 91 | 55 | 27 | 9 | 60.44% |
| app/lib/content-defaults.ts | 0 | 0 | 0 | 0 | n/a |
| app/lib/content.server.ts | 109 | 0 | 0 | 109 | 0.00% |
| app/lib/content.ts | 6 | 0 | 0 | 6 | 0.00% |
| app/lib/context.server.ts | 4 | 0 | 0 | 4 | 0.00% |
| app/lib/datasets.server.ts | 0 | 0 | 0 | 0 | n/a |
| app/lib/discovery.server.ts | 132 | 0 | 0 | 132 | 0.00% |
| app/lib/edge-cache.server.ts | 163 | 0 | 0 | 163 | 0.00% |
| app/lib/format.ts | 105 | 0 | 0 | 105 | 0.00% |
| app/lib/games.server.ts | 9 | 0 | 0 | 9 | 0.00% |
| app/lib/image-client.ts | 49 | 0 | 0 | 49 | 0.00% |
| app/lib/map.ts | 13 | 13 | 0 | 0 | 100.00% |
| app/lib/peaks.ts | 37 | 0 | 0 | 37 | 0.00% |
| app/lib/people.server.ts | 125 | 0 | 0 | 125 | 0.00% |
| app/lib/posts.server.ts | 140 | 0 | 0 | 140 | 0.00% |
| app/lib/posts.ts | 23 | 0 | 0 | 23 | 0.00% |
| app/lib/preview.server.ts | 30 | 0 | 0 | 30 | 0.00% |
| app/lib/r2.server.ts | 35 | 5 | 14 | 16 | 14.29% |
| app/lib/rss.server.ts | 111 | 0 | 0 | 111 | 0.00% |
| app/lib/sanitize.server.ts | 89 | 71 | 16 | 2 | 79.78% |
| app/lib/scores.server.ts | 49 | 0 | 0 | 49 | 0.00% |
| app/lib/security.server.ts | 65 | 0 | 0 | 65 | 0.00% |
| app/lib/sentry.server.ts | 54 | 0 | 0 | 54 | 0.00% |
| app/lib/seo.ts | 308 | 35 | 48 | 225 | 11.36% |
| app/lib/show.server.ts | 28 | 0 | 0 | 28 | 0.00% |
| app/lib/site.ts | 8 | 0 | 0 | 8 | 0.00% |
| app/lib/soundbites.server.ts | 26 | 0 | 0 | 26 | 0.00% |
| app/lib/subscribe.ts | 25 | 0 | 0 | 25 | 0.00% |
| app/lib/theme.ts | 30 | 0 | 0 | 30 | 0.00% |
| app/lib/versions.ts | 158 | 0 | 0 | 158 | 0.00% |
| app/lib/vtt.ts | 158 | 0 | 0 | 158 | 0.00% |
| app/lib/waveform-client.ts | 25 | 0 | 0 | 25 | 0.00% |
| workers/app.ts | 22 | 0 | 0 | 22 | 0.00% |

## Coverage follow-up (job_4a1b21f87c0d)

Tests added for the uncovered code, highest risk first. After each batch Stryker 9.6.1 (`--no-save`) was rerun
on that batch's files alone, with the full suite, and the score is recorded here next to the baseline. Every
new test kills at least one mutant in that run, which is its planted break seen failing; a test that killed
none was planted by hand and is named below. Mutant counts can differ from the baseline where a file changed
since 166ff3b or where newly covered static code is now counted.

| Batch | File | Baseline score | New score | Mutants (killed / survived / no coverage) |
|---|---|---|---|---|
| 1 auth | app/lib/access.server.ts | 78.13% | 90.63% | 64 (58 / 6 / 0) |
| 1 auth | app/lib/security.server.ts | 0.00% | 98.84% | 86 (85 / 1 / 0) |
| 1 auth | app/lib/preview.server.ts | 0.00% | 86.67% | 30 (26 / 3 / 1) |

Survivors left on purpose in batch 1: in `access.server.ts` the key-set cache (`if (!set)`), the
early `if (!token)` return and the catch body are equivalent mutants (jose throws on the same inputs and the
function returns null either way); in `preview.server.ts` the hex padding and the loop bound are equivalent
for a 32-byte digest.

## Per-test kill matrix

77 tests, keyed by file and test name; the full matrix (kills, unique kills, candidate kind, protected flag)
is `docs/research/kill-matrix.json`. Raw chunk reports are on the results branch.

| Group | Tests | Of which protected |
|-------|-------|--------------------|
| Zero-kill | 10 | 3 |
| Covered by others | 37 | 24 |
| Unprotected zero-kill candidates | 7 | |
| Unprotected covered-by-others candidates | 13 | |

Protected means the file or test name matches the keep rules in `scripts/report-mutation.mjs`: security,
auth, access, sanitizing and XSS, CSP, session, admin, backup and restore, secrets, and tests written for a
fixed bug. The match is a name heuristic that errs toward keeping.

## Removal candidates (nothing removed)

20 unprotected tests, in 3 files. By test file (protected counts in brackets), then the candidates:

| Test file | Tests | Zero-kill (protected) | Covered by others (protected) |
|---|---|---|---|
| test/carrel.test.ts | 15 | 4 (1) | 3 (1) |
| test/post-render.test.ts | 10 | 0 (0) | 7 (0) |
| test/sanitize.test.ts | 12 | 0 (0) | 5 (5) |
| test/csp-analytics.test.ts | 2 | 2 (2) | 0 (0) |
| test/backup.integration.test.ts | 4 | 0 (0) | 3 (3) |
| test/access.test.ts | 11 | 0 (0) | 5 (5) |
| test/backup.test.ts | 13 | 0 (0) | 10 (10) |
| test/map.test.ts | 10 | 4 (0) | 4 (0) |

- test/carrel.test.ts :: the guard: planted requests must be refused refuses a wrong key and no key (zero-kill)
- test/carrel.test.ts :: the guard: planted requests must be refused refuses an unknown route (zero-kill)
- test/carrel.test.ts :: the guard: planted requests must be refused refuses a stale expectedVersion and leaves the article as it was (covered)
- test/carrel.test.ts :: the guard: planted requests must be refused refuses a create when the id is taken, and a version for an id that does not exist (covered)
- test/carrel.test.ts :: media refuses a type the site did not declare and bytes that are not the declared type (zero-kill)
- test/post-render.test.ts :: demoteHeadings demotes the ladder by one so the page keeps a single h1 (covered)
- test/post-render.test.ts :: demoteHeadings leaves h4 and non-heading tags alone (covered)
- test/post-render.test.ts :: demoteHeadings returns empty input unchanged (covered)
- test/post-render.test.ts :: addHeadingIds injects an id on h2 and h3 so the table of contents can anchor (covered)
- test/post-render.test.ts :: addHeadingIds leaves headings outside the h2/h3 range alone (covered)
- test/post-render.test.ts :: the render pipeline in the order BodyRenderer applies it demotes first, then anchors the demoted headings (covered)
- test/post-render.test.ts :: the render pipeline in the order BodyRenderer applies it passes an empty body through without throwing (covered)
- test/map.test.ts :: toLatLng reads a dataset's [lng, lat] into Google's { lat, lng } (covered)
- test/map.test.ts :: toLatLng keeps the sign of each coordinate with its own axis (covered)
- test/map.test.ts :: every dataset's map center finds at least one dataset with a map, so the cases below are not vacuous (zero-kill)
- test/map.test.ts :: every dataset's map center cholera-soho-1854 is a coordinate that exists (zero-kill)
- test/map.test.ts :: every dataset's map center cholera-soho-1854 has points to be centered on (zero-kill)
- test/map.test.ts :: every dataset's map center cholera-soho-1854 sits within 5 degrees of its own points (zero-kill)
- test/map.test.ts :: siteIsDark with no explicit theme, the system decides, both ways (covered)
- test/map.test.ts :: siteIsDark an attribute value that is neither light nor dark falls through to the system (covered)

How to read this:

- Candidates are per test, not joint. Tests that only cover each other are all flagged, and removing all of
  them loses kills. Re-run Stryker after each batch.
- Three zero-kill candidates are not safe to cut on this list alone: the Carrel "guard" and media tests
  (wrong key, unknown route, undeclared media type) are request-refusal security checks that the name
  heuristic missed; treat them as protected. The four map-center tests are data-integrity checks on the
  datasets, which Stryker does not mutate, so zero kills is expected.
- With 77% of mutants uncovered and 239 survivors, adding tests is worth far more than trimming. The suite is
  small (80 tests) and runs in 11 s, so pruning saves almost nothing.

## Reproduce

```
npm i --no-save @stryker-mutator/core@9.6.1 @stryker-mutator/vitest-runner@9.6.1
for c in db carrel content rest; do STRYKER_CHUNK=$c npx stryker run; done
node scripts/report-mutation.mjs --table --json
```
