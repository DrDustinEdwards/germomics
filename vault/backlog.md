# germomics Backlog

Last updated: June 20, 2026.

## Build (one pass)
- [ ] Scaffold: npm create cloudflare@latest -- germomics --framework=next --platform=workers. Add drizzle-orm, drizzle-kit, next-auth, tailwindcss v4, lucide-react.
- [ ] wrangler.jsonc bindings (existing resources): DB -> D1 germomics, MEDIA -> germomics-audio, IMAGES -> germomics-blog-images. Run wrangler types.
- [ ] app/globals.css: Tailwind v4 with design tokens (build plan section 10) in :root (dark default) + :root[data-theme='light'], mapped via @theme inline; load the three fonts. lib/theme.ts for the data-theme toggle.
- [ ] lib/db.ts: drizzle over getCloudflareContext().env.DB. lib/r2.ts uploads. lib/auth.ts (Auth.js).
- [ ] Pages: home (combined feed + hero), /episodes, /writing, /archive (tabs), /[slug], /tag/[tag], /guests/[slug], /subscribe.
- [ ] Persistent queue player in the root layout: play this vs play all, speed, skip 15 and 30, chapter jump, synced transcript, share at timestamp, resume, Media Session. Accessibility: keyboard, no drag seek, 24px targets, never obscure focus.
- [ ] app/feed/podcast/route.ts plus a site feed for articles.
- [ ] Admin (single user Google OAuth + email allowlist): editor, R2 upload via MEDIA binding, transcript, chapters editor, guest picker, locked GUID, drafts, preview, publish, versions.
- [ ] WCAG 2.2 AA pass on public surfaces. Deploy: opennextjs-cloudflare deploy or wire Workers Builds.

## Infrastructure
- [x] R2 buckets created: germomics-audio, germomics-blog-images.
- [x] media.germomics.com bound to germomics-audio (Active, Min TLS 1.2).
- [x] D1 created + provisioned: germomics (uuid fbdeae30-5986-4816-9b7c-21136d8e372c, ENAM). Schema, FTS5, triggers, indexes applied live.
- [ ] Bind images.germomics.com to germomics-blog-images.
- [ ] Workers Paid plan ($5/mo) for SSR CPU headroom + 10 MiB bundle.
- [ ] R2 object versioning + lifecycle rules on both buckets (backup).
- [ ] Email Routing for germomics.com: inbound forwarders to your inbox; Gmail send-as for outbound (same as recovamrr.com).
- [ ] Stand up germomics-vault: deploy the claude-vault server (Vercel project or a Worker), env GITHUB_REPO=DrDustinEdwards/germomics, VAULT_PATH=vault. Add as a connector in Claude.

## Migration (zero disruption)
- [ ] Parse https://germomics.com/feed/podcast/, import each episode preserving guid exactly.
- [ ] Re upload MP3s to germomics-audio, keep old media URLs alive through cutover.
- [ ] Validate + diff feeds before flipping hosting. Directories (Apple id1478730454, Spotify 3XCPjDP9i1khOe6tw3bJb7, Amazon, Pandora PC:27352, TuneIn p1245474) need no change; feed path stays /feed/podcast/.

## Completed (June 20, 2026)
- [x] Stack locked: full Cloudflare. Next.js 16 + React 19 on Workers via OpenNext, D1 + Drizzle (native binding), R2, Auth.js v5 Google (JWT), Tailwind v4 @theme tokens, lucide-react. Verified current best practice via research.
- [x] Build plan written (docs/germomics_build_plan.html).
- [x] Design system locked: anchor #4F2D7F, cyan #0E7490 / #22D3EE, light + dark, Fraunces / Space Grotesk / JetBrains Mono.
- [x] Data model + podcast RSS route seeded.
