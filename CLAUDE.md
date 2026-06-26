# CLAUDE.md — germomics

Engineering conventions for this repo. Read this before writing code.

## What this is

germomics.com: a podcast and writing site about microbiology and history, plus interactive data pages (viruses and bacteria) and arcade browser games. Single author, single admin. Built independently and benchmarked to be best in class, native to Cloudflare. The canonical spec is `germomics_build_plan.html` (kept in the project). This file is the how; the build plan is the what and the why.

## Stack (fixed)

- React Router v7 (framework mode) + React 19 + TypeScript.
- Vite with the official Cloudflare plugin (`@cloudflare/vite-plugin`). The dev server runs in workerd, so local dev mirrors production.
- Cloudflare Workers for compute. Cloudflare D1 (SQLite) for data via Drizzle ORM. Cloudflare R2 for audio and images. Cloudflare KV for sessions.
- Better Auth for authentication (Google sign in, single allowlisted admin).
- Tailwind v4 for styling, with the germomics palette wired as design tokens. lucide-react for icons.

There is no Next.js and no OpenNext here. If a doc, snippet, or habit assumes Next, translate it to React Router before using it.

## Hard rules

1. All Cloudflare, native bindings. Reach D1, R2, and KV through `context.cloudflare.env` inside loaders and actions. Never call a Cloudflare service over HTTP, and never reach for a Node-only API. If something needs `nodejs_compat`, flag it before adding it.

2. Server and client are separated by file. A route module co-locates a server `loader`/`action` with a client component. Any server-only code (database queries, secrets, the Better Auth instance, R2 access) lives in a `*.server.ts` module. Never import a `.server` module, the Drizzle client, `context.cloudflare.env`, or a secret into code that runs in the browser. A server import leaking into a client bundle is a build break and a security problem; treat it as a blocker.

3. The podcast feed path is sacred. It is served at `/feed/podcast/` and that URL never changes. Episode `guid` values are immutable once published. Both are how every podcast directory keeps finding the show. Feeds are resource routes (a `loader` returning a raw `Response` with the right `Content-Type`), not React pages.

4. Drizzle for all data access. Define schema in `app/db/schema.ts`. Migrations are hand-authored additive SQL in `drizzle/` (kept in sync with the schema), applied with wrangler. Do not hand-write SQL in route code; use the query builder. Full text search uses the existing FTS5 virtual table.

5. Design system is locked. Anchor color `#4F2D7F` (crystal violet). Light and dark are both first class, switched via `data-theme` on the root element and remembered. Cyan (`#0E7490` light, `#22D3EE` dark) is reserved for interactive and now-playing states only. Fonts: a grotesk for display/UI, Fraunces for body, JetBrains Mono for timestamps and numbers. Do not introduce new colors or fonts without updating the build plan first.

6. Accessibility target is WCAG 2.2 AA on all public surfaces. The audio player is the highest-risk component: full keyboard support, a seek control that works without dragging, correct name/role/state on every control, 24px minimum targets. Maps and charts ship a text equivalent (summary or data table). Transcripts are required on every episode.

7. Keep the worker lean. Heavy client libraries (MapLibre for maps, Recharts for charts, **Phaser (Phaser 4)** for games) are `lazy()`-imported and code-split per route. They must never end up in the server bundle or the shared client chunk. The game engine is Phaser (Phaser 4): games are AI-written and Phaser's large training corpus generates more reliable, non-hallucinated code, with better performance and Safari/mobile behavior; its ~500KB only ever loads on an individual `/games/:slug` route.

## Content model (key columns)

The episode/article row (`posts`) and the single `show_config` row carry a few JSON columns worth knowing:

- `posts.sources` (JSON `Source[]`): the references and credits block, including image credits (`type:"image"`). One column, not a table. Figures themselves live in the body HTML.
- `posts.key_moments` (JSON `KeyMoment[]`, `{seconds,label}`): the curated, scannable "In this episode" list. Editorially distinct from `chapters` (player segments). Render key moments if present, else fall back to chapters; both seek the player.
- `posts.reading_time` (INTEGER minutes): computed from the body at save, so listing cards show it without loading the body.
- `show_config.hosts` (JSON `Host[]`, `{name,role,img,href}`): the show-level co-host byline. Per-episode `guests` stay on the post. Both map to `<podcast:person>` in the feed.
- `posts.audio_peaks` (JSON, the waveform contract): a fixed-length array of N=400 integers 0..100, each the normalized peak amplitude of one equal time-slice, scaled so the loudest slice is 100. Computed client-side in the admin browser at upload (`decodeAudioData` then the shared `app/lib/peaks.ts` bucketer); the 10 migrated episodes were backfilled once via `scripts/backfill-peaks.mjs`. Never decode audio in the Worker. The renderer divides by 100 and downsamples to its bar count (never upsamples), and falls back to a synthetic pattern when the value is null or malformed.

Listing loaders use the `cardColumns` projection in `posts.server.ts`, which omits the heavy detail-only fields (`body`, `transcript`, `audio_peaks`, `sources`, `key_moments`); only the single episode/article route loads the full body and transcript.

## Writing style (hard rule)

Applies to ALL site copy AND to any text the site generates (AI show notes, SEO, chapters). This is a house rule, not a preference.

- **No em dashes (the `—` character) anywhere.** Use commas, periods, parentheses, or colons instead.
- **No AI-writing tells.** Avoid: delve, tapestry, spans, landscape, realm, navigate, testament to, boasts, stands as, the "it's not just X, it's Y" construction, overwrought rule-of-three lists, and grandiose closing sentences.
- Write plain, direct, varied, human sentences. Prefer concrete nouns and short clauses over inflated phrasing.
- This rule is also baked into every generator prompt in `app/lib/ai.server.ts` (`STYLE_RULE`, appended to the shared system prompt). Keep the two in sync if either changes.
- Scope of "site copy": rendered page text, microcopy, titles/meta, and the generated `robots.txt` / `llms.txt` / `ai.txt`. It does not include source-code comments. Never edit migrated post/episode content in D1 to satisfy this rule.

## Commands

- `npm run dev` - Vite dev server in workerd, bindings available locally.
- `npm run build` - production build (client + server).
- `npm run deploy` - `wrangler deploy` (Workers Builds runs this in CI on push).
- `npm run typegen` - regenerate `worker-configuration.d.ts` from wrangler config after any binding change.
- Migrations are hand-authored additive SQL in `drizzle/` (kept in sync with `schema.ts`), applied with wrangler. drizzle-kit is not used.
- `npm run db:migrate` - apply migrations to the local D1.
- `npm run db:migrate:prod` - apply migrations to the remote D1.
- `npm run auth:generate` - regenerate Better Auth tables into the Drizzle schema after changing auth config.

## File layout

```
app/
  root.tsx                  root layout: <html>, theme, the persistent player lives here
  routes.ts                 route config
  routes/
    _index.tsx              home (combined feed, seeds the queue)
    episodes._index.tsx     episode list
    writing._index.tsx      article list
    archive.tsx             filterable all / episodes / writing
    $slug.tsx               episode or article detail (branch on kind)
    tag.$tag.tsx            tag page
    guests.$guest.tsx       guest page
    data._index.tsx         data hub
    data.$slug.tsx          a virus/bacteria data page (client-only map/charts)
    games._index.tsx        games hub
    games.$slug.tsx         a game (client-only canvas/WebGL)
    subscribe.tsx
    feed.podcast[.]xml.ts   -> served at /feed/podcast/ ; resource route, XML
    feed.site[.]xml.ts      site feed for the writing
    api.auth.$.ts           Better Auth catch-all (loader + action)
    admin.*                 single-admin editor, gated
  db/
    schema.ts               Drizzle schema (posts, post_versions, show_config, + Better Auth tables)
    index.server.ts         drizzle(env.DB) factory
  lib/
    auth.server.ts          Better Auth instance
    r2.server.ts            R2 upload/read helpers
    rss.server.ts           feed XML builders
    posts.server.ts         post queries
    theme.ts                data-theme helper (client-safe)
  components/
    player/                 persistent queue player
    ...
workers/
  app.ts                    worker entry; injects context.cloudflare.env into RR
drizzle/                    generated migrations
wrangler.jsonc              bindings
```

## Reference, do not copy blindly

Study the patterns in the existing Recova and Foxing repos for house style (token wiring, theme switching, lib helper shape, Drizzle usage), then apply current best practice for React Router v7 on Cloudflare. Those apps are Next.js; take the conventions, not the framework. When a community RR7 + Better Auth + Drizzle + D1 template disagrees with an old habit, prefer the template.

## Definition of done for a feature

Type-checks clean, server/client boundary respected (`.server` only on the server), accessible (keyboard + names/roles), works against local D1 and against a preview deploy, and does not regress the worker bundle size.
