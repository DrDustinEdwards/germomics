import { type RouteConfig, index, route } from "@react-router/dev/routes";
import { INDEXNOW_KEY } from "./lib/site";

export default [
  index("routes/_index.tsx"),

  // sections
  route("episodes", "routes/episodes._index.tsx"),
  route("season/:num", "routes/season.$num.tsx"),
  route("writing", "routes/writing._index.tsx"),
  route("archive", "routes/archive.tsx"),
  route("search", "routes/search.tsx"),
  route("data", "routes/data._index.tsx"),
  route("data/:slug", "routes/data.$slug.tsx"),
  route("charts.css", "routes/charts-css.ts"),
  route("games", "routes/games._index.tsx"),
  route("games/assets/*", "routes/games.assets.$.ts"),
  // resized images from BLOG_IMAGES (app/lib/images.ts)
  route("media/*", "routes/media.$.ts"),
  route("games/:slug", "routes/games.$slug.tsx"),
  route("tag/:tag", "routes/tag.$tag.tsx"),
  route("guests/:guest", "routes/guests.$guest.tsx"),
  route("subscribe", "routes/subscribe.tsx"),
  route("unsubscribe", "routes/unsubscribe.tsx"),
  route("about", "routes/about.tsx"),
  route("about/dustin-edwards", "routes/about.dustin-edwards.tsx"),
  route("privacy", "routes/privacy.tsx"),
  route("terms", "routes/terms.tsx"),
  route("contact", "routes/contact.tsx"),
  route("txasm", "routes/txasm.tsx"),

  // ops
  route("health", "routes/health.ts"),

  // feeds — resource routes. The podcast feed is matched at /feed/podcast/ (trailing slash,
  // the immutable URL directories poll) with no redirect to/from a non-slash variant.
  route("feed/podcast", "routes/feed.podcast.ts"),
  route("feed/site.xml", "routes/feed.site.ts"),

  // discovery
  route("sitemap.xml", "routes/sitemap.ts"),
  route("robots.txt", "routes/robots.ts"),
  route("site.webmanifest", "routes/site-webmanifest.ts"),
  // GEO / agentic-web discovery files (dynamic from D1, served noindex)
  route("llms.txt", "routes/llms.ts"),
  route("llms-full.txt", "routes/llms-full.ts"),
  route("ai.txt", "routes/ai-txt.ts"),
  route(".well-known/security.txt", "routes/security-txt.ts"),
  route(`${INDEXNOW_KEY}.txt`, "routes/indexnow-key.ts"),
  // Google Search Console ownership proof. The path is Google's and never changes; removing it
  // un-verifies the property. See the route file.
  route("google7e6923f5a0eb8ba9.html", "routes/google-verification.ts"),

  // per-episode resource endpoints referenced by the podcast feed
  route(":slug/transcript.vtt", "routes/transcript.ts"),
  route(":slug/chapters.json", "routes/chapters.ts"),

  // admin: Cloudflare Access signs people in; admin.tsx middleware re-verifies its JWT once for the
  // whole subtree.
  route("admin", "routes/admin.tsx", [
    index("routes/admin._index.tsx"),
    route("episodes", "routes/admin.episodes._index.tsx"),
    route("episodes/:id", "routes/admin.episodes.$id.tsx"),
    route("people", "routes/admin.people._index.tsx"),
    route("subscribers", "routes/admin.subscribers._index.tsx"),
    route("soundbites", "routes/admin.soundbites._index.tsx"),
    route("settings", "routes/admin.settings._index.tsx"),
    route("content/:key", "routes/admin.content.$key.tsx"),
    route("upload", "routes/admin.upload.ts"),
    route("media/backfill", "routes/admin.media-backfill.ts"),
  ]),

  // Carrel's preview links (/preview/<token>) are answered by the Worker before the app (workers/app.ts).

  // episode/article detail — single dynamic segment, ranked below every static route above.
  route(":slug", "routes/$slug.tsx"),
] satisfies RouteConfig;
