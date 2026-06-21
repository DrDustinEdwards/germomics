# CLAUDE.md germomics

## BEHAVIOR
germomics is the clean best-practice baseline. Recova was the first project and carries
early debt, so it is a reference for brand and preferences only, not architecture. Build
to current 2026 best practice. Flat single app repo. Plan fully, build in one pass.

## STACK (locked, June 2026) - full Cloudflare
- Next.js 16 (App Router, TypeScript), React 19.
- Hosting: Cloudflare Workers via OpenNext (@opennextjs/cloudflare). No Vercel. Storage
  reaches code through native bindings, not HTTP.
- Data: Cloudflare D1 with Drizzle (drizzle-orm/d1) over the native DB binding. FTS5 search
  (already applied live).
- Media: Cloudflare R2. Public reads via media.germomics.com (audio) and
  images.germomics.com (images); uploads via the R2 binding. Enclosure URLs always
  media.germomics.com.
- Auth: Auth.js v5, Google provider, single allowlisted email, JWT sessions (no auth
  tables). Verify it runs on workerd during build.
- Styling: Tailwind v4. Design tokens as CSS vars in :root (dark default) and
  :root[data-theme='light'], mapped into Tailwind via @theme inline. Theme via a
  data-theme attribute.
- Icons: lucide-react.
- Plan: Workers Paid ($5/mo) for SSR CPU headroom and the 10 MiB compressed bundle ceiling.

## BINDINGS (wrangler.jsonc) - existing resources, do NOT recreate
- DB     -> D1 germomics, id fbdeae30-5986-4816-9b7c-21136d8e372c (created + schema applied)
- MEDIA  -> R2 germomics-audio
- IMAGES -> R2 germomics-blog-images
Access via getCloudflareContext().env. Run wrangler types (cf-typegen) for cloudflare-env.d.ts.

## ENV VARS (mind the build vs runtime split)
- Local: Next.js .env files (.env, .env.development); work in next dev and wrangler dev.
- Runtime (prod): Cloudflare dashboard or wrangler secret put. Secrets are write-only.
- Build (NEXT_PUBLIC_* inlining + any build-needed var): also set in Workers Builds
  "Build variables and secrets", or the build fails. Add keep_vars = true so deploys do
  not wipe dashboard vars. Never commit .env* or .dev.vars*.

## STRUCTURE
app/        layout.tsx, page.tsx, globals.css (Tailwind v4 @theme + :root tokens), route
            groups, feed/podcast/route.ts
components/ section + chrome components (lucide-react)
db/         schema.ts (Drizzle), schema.sql (canonical DDL, already applied to D1)
lib/        db.ts (drizzle over getCloudflareContext().env.DB), r2.ts, auth.ts, theme.ts,
            rss.ts, format.ts, metadata.ts, constants.ts
vault/      TASK.md, backlog.md
docs/       germomics_build_plan.html, germomics_kickoff.md
wrangler.jsonc, open-next.config.ts, .dev.vars.example, CLAUDE.md, .claude/settings.json

## SCAFFOLD
npm create cloudflare@latest -- germomics --framework=next --platform=workers
Adds Next + OpenNext + wrangler. Then add drizzle-orm, drizzle-kit (dev), next-auth,
tailwindcss v4 (@tailwindcss/postcss), lucide-react. Build on Linux/macOS/WSL, not bare
Windows (OpenNext requirement).

## COMMANDS
- dev: next dev
- preview (workerd, accurate to prod): opennextjs-cloudflare preview
- deploy: opennextjs-cloudflare deploy (or wire Workers Builds for git-push deploys)
- types: wrangler types
- typecheck: npx tsc --noEmit (keep clean before deploy)

## BACKUP
- D1: Time Travel is always on, restore to any minute in the last 30 days. Optional Cron
  Trigger Worker that dumps D1 to SQL in R2 for off-site copies.
- R2: enable object versioning + lifecycle rules on both buckets.
- Code: git is the source of truth.

## ABSOLUTE RULES (germomics invariants, firm)
- Enclosure URLs always point at media.germomics.com, never the Worker origin.
- guid is permanent and immutable, reuse the old feed GUIDs on import.
- Podcast feed is episodes only (every item has an enclosure), articles use the site feed.
- Every episode ships a transcript.
- Cyan accent #0E7490 light, #22D3EE dark, for interactive and now playing only.
- Design tokens only, no hard coded colors (wire through @theme).

## GIT WORKFLOW
Small commits to main. Wire Workers Builds for push-to-deploy. tsc clean before push.
