# germomics Claude Code kickoff

Build germomics in one pass per docs/germomics_build_plan.html and this file. Full
Cloudflare stack: Next.js 16 on Workers via OpenNext, native D1 + R2 bindings. Clean
best-practice baseline; do not copy legacy patterns from Recova.

## Stack (locked)
Next.js 16 (App Router, TS), React 19. Hosting: Cloudflare Workers via OpenNext
(@opennextjs/cloudflare). Data: D1 + Drizzle over the native binding. Media: R2
(media.germomics.com, images.germomics.com). Tailwind v4 with @theme tokens. lucide-react.
Auth.js v5 Google, single email, JWT. SQLite FTS5 search. Workers Paid plan.

## Scaffold
npm create cloudflare@latest -- germomics --framework=next --platform=workers
cd germomics
npm i drizzle-orm next-auth lucide-react
npm i -D drizzle-kit
gh repo create DrDustinEdwards/germomics --private --source=. --push
Build on Linux/macOS/WSL (not bare Windows).

## wrangler.jsonc bindings - existing resources, do NOT recreate
"d1_databases": [
  { "binding": "DB", "database_name": "germomics", "database_id": "fbdeae30-5986-4816-9b7c-21136d8e372c" }
],
"r2_buckets": [
  { "binding": "MEDIA",  "bucket_name": "germomics-audio" },
  { "binding": "IMAGES", "bucket_name": "germomics-blog-images" }
]
Then run wrangler types for cloudflare-env.d.ts.

## Build order (one pass)
1. app/globals.css: Tailwind v4. Design tokens from build plan section 10 as CSS vars in
   :root (dark default) and :root[data-theme='light'], mapped via @theme inline. Fonts
   Space Grotesk, Fraunces, JetBrains Mono. lib/theme.ts for the data-theme toggle.
2. lib/db.ts: drizzle(getCloudflareContext().env.DB). schema.ts is written; schema.sql is
   already live in D1 (posts, post_versions, show_config, posts_fts + triggers). lib/r2.ts
   for uploads, lib/auth.ts for Auth.js.
3. Pages: home (combined feed + latest episode hero), /episodes, /writing, /archive
   (tabs), /[slug] (episode + article), /tag/[tag], /guests/[slug], /subscribe.
4. Persistent queue player in the root layout (single audio element): play this vs play
   all, speed 0.8 to 2x, skip 15 and 30 seconds, chapter jump, synced clickable
   transcript, share at timestamp, resume, Media Session API. Accessibility: keyboard,
   no drag seek, 24px targets, never obscure focus.
5. app/feed/podcast/route.ts (written) at /feed/podcast/, plus a site feed for articles.
6. Admin (single user, Google OAuth + email allowlist): editor, R2 upload via the MEDIA
   binding (auto duration + byte size), transcript, chapters editor, guest picker, locked
   GUID, drafts, preview, publish, version history.
7. Migration: parse https://germomics.com/feed/podcast/, import each episode preserving
   guid exactly, re upload MP3s to germomics-audio.
8. WCAG 2.2 AA pass on public surfaces. Deploy: opennextjs-cloudflare deploy, or wire
   Workers Builds for push-to-deploy.

## Env vars
Local: Next.js .env files. Runtime: dashboard or wrangler secret put. Build-needed and
NEXT_PUBLIC_* also go in Workers Builds "Build variables and secrets". keep_vars = true.

## Notes
Confirm Auth.js v5 runs on workerd. Enclosures always media.germomics.com. Mind the 10 MiB
compressed Worker bundle; Workers Paid plan for CPU headroom. Recova/Foxing stay on Vercel
until migrated later.
