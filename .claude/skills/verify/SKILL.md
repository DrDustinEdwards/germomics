---
name: verify
description: Use before committing or opening a pull request that changes what germomics.com shows or does (app/, workers/, drizzle/, the feeds, search, the player, the data pages). Boots the app in Vite on workerd with a local D1 and a seed, drives the changed public flow in Chromium with Playwright, runs the vitest files that cover the area, and reports the evidence. Admin behind Access, email, R2 and Images are proved by test/ and the live check, not here.
---

# Verify a germomics change

Do it before every commit that touches `app/`, `workers/` or `drizzle/`, and before
the pull request.

## 1. Boot the app on a local D1

From the repo root, on the repo's Node (`.nvmrc` is 26.12.1, `engines` is 22.22 or
later; in a cloud session put the Node 26 the SessionStart hook installs on PATH):

```sh
npm ci
[ -f .dev.vars ] || cp .dev.vars.example .dev.vars
npm run db:migrate
npx wrangler d1 execute germomics --local --file scripts/seed.local.sql
```

`ACCESS_DEV_BYPASS=1` in the example `.dev.vars` lets localhost past the Access check.
`db:migrate` applies `drizzle/` to the local D1 under `.wrangler/state`. The seed
(local only) replaces `posts` and `show_config` with one show and a few posts, among
them the episode "The Purple Stain" (`/the-purple-stain`).

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
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  const log = [];
  async function step(name, fn) {
    try {
      await fn();
      log.push(`ok   ${name}`);
    } catch (e) {
      log.push(`FAIL ${name}: ${e.message.split("\n")[0]}`);
      await page.screenshot({ path: "fail.png", fullPage: true });
      throw e;
    }
  }
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

Drive the whole flow (act, see the result, reload and see it hold); repeat the end
state at 390 px and dark when the change is responsive or themed.

The first run after the server starts also logs `504 (Outdated Optimize Dep)` loads
while Vite optimizes dependencies; run the script a second time. A `TrustedHTML` or
hydration error is a finding. `npm run dev` also adds a devkit dev toolbar, which logs
a 404 for `/@devkit/axe.js` and `Cannot read properties of null` from `toolbar.js`;
anything else in the list is a finding.

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
two files, not the whole suite; CI runs all of it. Pick the files named for the area
(`ls test/`):

```sh
npx vitest run test/posts-visibility.test.ts test/feeds.test.ts
```

Run `npm run check:migrations` after a schema change, and the other checks your change
can trip (`typecheck`, `lint`, `format:check`, `check:console`, `nobloat`) before the
pull request.

## Rules

A failed step is a finding about the change: fix the code and rerun the same script;
no sleeps, no looser selectors.

## The report

Put this in the reply and the pull request body:

- First line: verified, partly verified (and what was not), or failed.
- Each step's ok or FAIL line, the console errors line, the end-state screenshot
  attached, and the test run's summary lines (`Test Files`, `Tests`).
- Not verified: Cloudflare Access (the bypass only skips the check), Carrel's site API
  against the real site, audio and images (R2 and Images are empty locally), email,
  Workers AI, the edge cache, the crons. The live
  check runs after the merge: CI's `deploy` job (`.github/workflows/ci.yml`) waits
  for `/health` to report the commit, fetches https://germomics.com/ and rolls back
  if it does not answer 200; look at https://germomics.com/health and the home page
  after it.
