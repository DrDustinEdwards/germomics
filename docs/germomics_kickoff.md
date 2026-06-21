# germomics — kickoff (React Router v7 on Cloudflare)

Everything needed to scaffold and build germomics in one pass. The Cloudflare infrastructure already exists; this rebuilds the app on it natively. Work top to bottom, but plan the whole thing first and build it in one sweep, not in deferred phases.

## Existing infrastructure (reuse, do not recreate)

| Resource | Name | Binding | Notes |
|---|---|---|---|
| D1 database | `germomics` | `DB` | uuid `fbdeae30-5986-4816-9b7c-21136d8e372c`, region ENAM. Content schema already live: `posts`, `post_versions`, `show_config`, `posts_fts` (+ triggers, unique slug/guid indexes). |
| R2 bucket | `germomics-audio` | `MEDIA` | public, custom domain `media.germomics.com` (active). Podcast MP3s. |
| R2 bucket | `germomics-blog-images` | `BLOG_IMAGES` | custom domain `images.germomics.com` (binding pending). |
| Account |  |  | id `f852925ce701e6c56f6feae83f0eb2d3`, Workers subdomain `dustin-edwards.workers.dev`. |

## To create during build

- KV namespace `APP_KV` -> binding `APP_KV` (Better Auth sessions).
- R2 bucket `germomics-game-assets` -> binding `GAME_ASSETS` (sprites, sfx, wasm).
- Google OAuth client (Google Cloud Console) for Better Auth.

## 0. Repo

Rebuild in the existing repo `DrDustinEdwards/germomics` (local: `C:\Users\email\dev\germomics`). The Next.js version stays in git history. Start the RR7 app on a clean branch, then make it the default once it builds and deploys.

## 1. Scaffold

```bash
npm create cloudflare@latest germomics -- --framework=react-router
```

This gives React Router v7 + the Cloudflare Vite plugin + wrangler + a `workers/app.ts` entry that injects `context.cloudflare.env`. Then add: `drizzle-orm drizzle-kit`, `better-auth`, `tailwindcss@4 @tailwindcss/vite`, `lucide-react`. Add charts (`recharts`) and a map lib (`maplibre-gl`) and the game engine **Phaser (Phaser 4, `phaser`)** as needed, behind lazy imports. Phaser is fixed (not Kaplay): games are AI-written, and Phaser's far larger corpus yields more reliable, non-hallucinated game code, with better performance and Safari/mobile behavior. Its ~500KB is a non-issue — each game is lazy-loaded and code-split on its own `/games/:slug` route and never touches the content pages.

## 2. Bindings

Write `wrangler.jsonc` with all five bindings (`DB`, `MEDIA`, `BLOG_IMAGES`, `APP_KV`, `GAME_ASSETS`), plus `compatibility_date` recent and `compatibility_flags: ["nodejs_compat"]` only if Better Auth requires it. Run `npm run typegen` to emit `worker-configuration.d.ts`. Confirm a loader can read `context.cloudflare.env.DB`.

## 3. Data layer

Two files are provided. Copy `schema.ts` to `app/db/schema.ts` as-is (it is framework-agnostic Drizzle): `posts` with the `kind` discriminator and episode fields, `post_versions`, `show_config`, plus the `Chapter` and `Guest` types. The FTS5 search table and its sync triggers are not expressible in Drizzle, so they live in `db_schema.sql` (dumped verbatim from the live D1) — apply that as a raw migration. The live D1 already contains all of this; generate a baseline migration and reconcile against it rather than dropping anything. The `drizzle(context.cloudflare.env.DB)` factory goes in `app/db/index.server.ts`. Search query pattern: `SELECT p.* FROM posts_fts f JOIN posts p ON p.id = f.rowid WHERE posts_fts MATCH ?`.

## 4. Auth (Better Auth)

- `app/lib/auth.server.ts`: Better Auth with the Drizzle adapter (sqlite provider, the `DB` binding), Google social provider, sessions in `APP_KV` via secondary storage, and a check that locks sign-in to the single `ADMIN_EMAIL`.
- `app/routes/api.auth.$.ts`: a catch-all whose `loader` and `action` both return `auth.handler(request)`.
- Run `npm run auth:generate` to emit the Better Auth tables (user, session, account, verification) into the Drizzle schema, then generate + apply a migration. Gate every `admin.*` route on a valid admin session.

## 5. Build the site in one pass

Public: home (combined feed, seeds the queue), `/episodes`, `/writing`, `/archive` (tabs), `$slug` detail (branch on `kind`), tag and guest pages, `/subscribe`, newsletter capture. Persistent queue player in `app/root.tsx` (skip, speed, chapters, synced transcript, share-at-timestamp, resume, Media Session). Feeds: `/feed/podcast/` and the site feed as resource routes. Data: `/data` hub + `/data/$slug` client-only maps/charts (lazy, code-split, with an SEO shell and a text equivalent). Games: `/games` hub + `/games/$slug` client-only canvas, assets from `GAME_ASSETS`, leaderboards via a D1 action. Admin: audio upload to R2 (auto duration + byte size), transcript + chapters editors, guest picker, locked GUID generation, drafts/preview/publish, version snapshots.

## 6. Secrets (runtime, set in the dashboard or `wrangler secret put`)

`BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_EMAIL`, and `BETTER_AUTH_URL` (or configure trusted origins). All runtime-only; none are needed at build time. Google OAuth callback: `https://germomics.com/api/auth/callback/google` (add the workers.dev and localhost callbacks for dev/preview).

## 7. Deploy

`npm run build` then `wrangler deploy`. Wire Workers Builds to the repo: build command `npm run build`, deploy command `npx wrangler deploy`. It auto-detects React Router. Verify the preview deploy reads D1/R2 before promoting.

## 8. Migration (after the site is live, run separately)

Parse the current feed at `https://germomics.com/feed/podcast/`, import each episode preserving its `<guid>` exactly, re-upload MP3s to `germomics-audio`, keep old media URLs alive through cutover, then validate and diff the new `/feed/podcast/` against the old before flipping DNS. Directory IDs on file: Apple 1478730454, Spotify 3XCPjDP9i1khOe6tw3bJb7, Amazon b9a6c5c3-9ae1-4f08-b356-793213f9690a, Pandora PC:27352, TuneIn p1245474. No directory edits needed since the path is unchanged.

## Stop point

Build everything through step 7 and push. Do not run the DNS cutover (step 8) automatically; that is a deliberate, separate go.
