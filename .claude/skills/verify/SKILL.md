---
name: verify
description: Use before committing or opening a pull request that changes what germomics.com shows or does (app/, workers/, drizzle/, the feeds, search, the player, the data pages). Boots the app in Vite on workerd with a local D1 and a seed, drives the changed public flow in Chromium with Playwright, runs the vitest files that cover the area, and reports the evidence. Admin behind Access, email, R2 and Images are proved by test/ and the live check, not here.
---

# Verify a germomics change

Tests prove what someone thought to test. This skill proves the change itself: run
the real app, use the changed flow as a listener or reader would, and look at the
result. Do it before every commit that touches `app/`, `workers/` or `drizzle/`, and
before the pull request. Deploys are CI's, never a hand `npm run deploy`, and never
`db:migrate:prod`.

## 1. Boot the app on a local D1

From the repo root, on the repo's Node (`.nvmrc` is 26.12.1, `engines` is 22.22 or
later; in a cloud session prepend a Node 26 to PATH, for example
`~/.cache/capsid-node/node-v26.13.1-linux-x64/bin`):

```sh
npm ci
[ -f .dev.vars ] || cp .dev.vars.example .dev.vars
npm run db:migrate
npx wrangler d1 execute germomics --local --file scripts/seed.local.sql
```

`.dev.vars` is gitignored (never commit it); the example's values are fake and
`ACCESS_DEV_BYPASS=1` lets localhost past the Access check. `wrangler.jsonc` is
committed here and needs no copy. `db:migrate` applies `drizzle/` to the local D1
under `.wrangler/state`. The seed (local only, not a migration) replaces `posts` and
`show_config` with one show and a few posts, among them the episode "The Purple
Stain" (`/the-purple-stain`). It deletes those two tables first, which is safe
because this D1 is local.

Check the port is free, then start Vite (workerd, local D1, bindings from
`wrangler.jsonc`) in the background:

```sh
curl -s -o /dev/null -m 2 http://localhost:5173/ && echo "5173 is busy: pick another port below" || echo "5173 free"
npm run dev -- --port 5173 --strictPort    # run in the background
```

If 5173 is busy it may be another repo's server: use another port in both commands.
The first request compiles and takes up to a minute. Wait until
`curl -s -o /dev/null -w '%{http_code}' -m 90 http://localhost:5173/` prints 200, then
confirm it is this app: `curl -s http://localhost:5173/ | grep -o '<title>[^<]*'`
prints `Germomics · microbiology &amp; history`, and `/health` answers `"db":"up"`
(a `warn` about backups is normal locally).

What local shows: the public pages (home, episodes, an episode with its player and
transcript, writing, archive, data, games, search, tags, season pages), the feeds
(`/feed/podcast/`, `/feed/site`, `/sitemap`, `/llms.txt`), the headers the Worker
sends, and the schema from every migration. What it cannot show: Cloudflare Access
(the bypass only skips the check, so `/admin` is not a real sign-in test), Carrel's
site API against the real site, audio and images (R2 and the Images binding are
empty locally, so the seeded audio URLs point at production hosts and players show
no real waveform), email, Workers AI, the edge cache and the cron jobs.

## 2. Drive the changed flow

The repo has no browser driver, so use the container's preinstalled Playwright. In a
cloud session `require('playwright')` works from any directory in a `.cjs` script and
`chromium.launch()` needs no options. A local session without it needs Playwright
from elsewhere; do not run `playwright install`. Write the script in the session's
scratchpad, never in the repo. Name each step the way a person would say it, act
through roles and labels, and assert what the person should see afterward. Collect
console errors and page errors, and keep a screenshot of the end state.

```js
// <scratchpad>/drive.cjs: cd <scratchpad> && node drive.cjs http://localhost:5173
const { chromium } = require("playwright");
(async () => {
  const base = process.argv[2].replace(/\/$/, "");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // errors, log and step(): the helpers in devkit docs/verify.md
  try {
    await step("open the home page", async () => {
      const r = await page.goto(base + "/");
      if (!r.ok()) throw new Error(`status ${r.status()}`);
      await page.getByRole("link", { name: "Germomics", exact: true }).first().waitFor();
      log.push(`     title: ${await page.title()}`);
    });
    await step("go to Episodes", async () => {
      await page.getByRole("link", { name: "Episodes" }).first().click();
      await page.getByRole("heading", { name: "Episodes", level: 1 }).waitFor();
    });
    await step("open The Purple Stain", async () => {
      await page.getByRole("link", { name: "The Purple Stain" }).first().click();
      await page.getByRole("heading", { name: "The Purple Stain", level: 1 }).waitFor();
    });
    await step("search for gram", async () => {
      await page.getByRole("link", { name: "Search" }).first().click();
      await page.getByRole("searchbox", { name: "Search Germomics" }).fill("gram");
      await page.getByRole("button", { name: "Go" }).click();
      await page.getByText("for “gram”").waitFor();
      await page.getByRole("link", { name: "The Purple Stain" }).first().waitFor();
    });
    // ...the changed flow: click, fill, submit, then assert the visible result.
    await page.screenshot({ path: "after.png", fullPage: true });
  } finally {
    console.log(log.join("\n"));
    console.log("console errors:", errors.length ? errors : "none");
    await browser.close();
  }
})();
```

Drive the whole flow, not just the page load: follow the link, submit the form, see
the result, go back, reload and see it hold. If the change is responsive or themed,
repeat the end state at 390 px wide and in dark mode (`page.setViewportSize`,
`page.emulateMedia({ colorScheme: "dark" })`). A change to the audio player needs
keyboard and name, role and state checks on every control (CLAUDE.md, hard rule 3);
a change to a game route needs `/games/<slug>` only, because Phaser loads nowhere
else (hard rule 4).

The first run after the server starts also logs `504 (Outdated Optimize Dep)` loads
while Vite optimizes dependencies. Run the script a second time for the real result.
A `TrustedHTML` or hydration error is never noise: it is a finding, even if a rerun
passes. One run hit both on 2026-11-17 while the machine was busy, and six reruns
passed; the cause was not found, so name it in the report if it comes back.
`npm run dev` also adds a devkit dev toolbar, which logs known console errors that
production does not: a 404 for `/@devkit/axe.js` and `Cannot read properties of null
(reading 'replaceChildren')` or `(setting 'hidden')` from `toolbar.js`. Anything else in
the list is a finding.

Stop the dev server you started. `npm run dev` leaves `react-router dev` running when its own process is killed,
so stop the server by the port you chose, which only your server holds because of
`--strictPort` (never `pkill` by name: other sessions may run servers on the same
machine):

```sh
kill $(pgrep -f "react-router dev --port 5173 --strictPort")
```

Then remove `.dev.vars` if you made it, and check that `git status` shows nothing new.

## 3. Run the tests that cover the area

`npm test` is vitest on real D1, KV, R2 and Durable Objects in Miniflare (bindings
are declared in `vitest.config.ts`, so a run never touches production). Run one or
two files, not the whole suite; CI runs all of it:

```sh
npx vitest run test/posts-visibility.test.ts test/feeds.test.ts
```

| Area changed                                     | File                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------- |
| Scheduled posts, what is publicly visible        | `test/posts-visibility.test.ts`                                           |
| Podcast feed, GUIDs, enclosures                  | `test/feeds.test.ts`, `test/rss.test.ts`                                  |
| Saving a post, rendering, sanitizing             | `test/post-render.test.ts`                                                |
| Carrel's site API                                | `test/carrel.test.ts`, `carrel-adapter`, `carrel-source`                  |
| Media library and images                         | `test/carrel-media.test.ts`, `test/images.test.ts`                        |
| Admin gate, uploads                              | `test/admin-routes.test.ts`, `test/upload.test.ts`                        |
| Newsletter signup                                | `test/public-writes.test.ts`                                              |
| Game scores, rate limits                         | `test/scores.test.ts`, `test/security.test.ts`                            |
| Schema or a migration                            | `test/schema.test.ts`, then `npm run check:migrations`                    |
| Nightly backup, operator API                     | `test/backup.integration.test.ts`, `test/operator.test.ts`                |
| SEO, llms.txt, JSON-LD, Worker entry, health     | `test/seo.test.ts`, `test/discovery.test.ts`, `test/worker-entry.test.ts` |
| People, soundbites, show config, episode context | `test/people-soundbites-show.test.ts`, `test/episode-context.test.ts`     |

CI's `verify` job also runs `npm run typecheck`, `npm run lint`,
`npm run format:check`, `npm run build`, `npm run check:console`,
`npm run check:migrations`, `npm run nobloat` and `npm run nobloat:weight`. Run the
ones your change can trip before the pull request. A new migration in `drizzle/` is
hand-written, additive SQL, kept in sync with `app/db/schema.ts` (hard rule 2).

## Rules and report

Follow the Rules and the report in [devkit's docs/verify.md](https://github.com/DrDustinEdwards/devkit/blob/main/docs/verify.md). For this repo:

- Anything local cannot show (the real Access sign-in, audio and images from R2,
  email, Workers AI, the edge cache, the crons), named as not verified. The live
  check runs after the merge: CI's `deploy` job (`.github/workflows/ci.yml`) waits
  for `/health` to report the commit, fetches https://germomics.com/ and rolls back
  if it does not answer 200; look at https://germomics.com/health and the home page
  after it.
