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

4. Drizzle for all data access. Define schema in `app/db/schema.ts`. Generate migrations with drizzle-kit, apply with wrangler. Do not hand-write SQL in route code; use the query builder. Full text search uses the existing FTS5 virtual table.

5. Design system is locked. Anchor color `#4F2D7F` (crystal violet). Light and dark are both first class, switched via `data-theme` on the root element and remembered. Cyan (`#0E7490` light, `#22D3EE` dark) is reserved for interactive and now-playing states only. Fonts: a grotesk for display/UI, Fraunces for body, JetBrains Mono for timestamps and numbers. Do not introduce new colors or fonts without updating the build plan first.

6. Accessibility target is WCAG 2.2 AA on all public surfaces. The audio player is the highest-risk component: full keyboard support, a seek control that works without dragging, correct name/role/state on every control, 24px minimum targets. Maps and charts ship a text equivalent (summary or data table). Transcripts are required on every episode.

7. Keep the worker lean. Heavy client libraries (MapLibre, Leaflet, chart libs, game engines) are `lazy()`-imported and code-split per route. They must never end up in the server bundle or the shared client chunk.

## Commands

- `npm run dev` - Vite dev server in workerd, bindings available locally.
- `npm run build` - production build (client + server).
- `npm run deploy` - `wrangler deploy` (Workers Builds runs this in CI on push).
- `npm run typegen` - regenerate `worker-configuration.d.ts` from wrangler config after any binding change.
- `npm run db:generate` - generate a Drizzle migration from schema changes.
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
