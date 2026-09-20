import { type RouteConfig, index, route } from "@react-router/dev/routes";

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
  route("games", "routes/games._index.tsx"),
  route("games/assets/*", "routes/games.assets.$.ts"),
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
  // GEO / agentic-web discovery files (dynamic from D1, served noindex)
  route("llms.txt", "routes/llms.ts"),
  route("llms-full.txt", "routes/llms-full.ts"),
  route("ai.txt", "routes/ai-txt.ts"),
  // Google Search Console ownership proof. The path is Google's and never changes; removing it
  // un-verifies the property. See the route file.
  route("google7e6923f5a0eb8ba9.html", "routes/google-verification.ts"),

  // per-episode resource endpoints referenced by the podcast feed
  route(":slug/transcript.vtt", "routes/transcript.ts"),
  route(":slug/chapters.json", "routes/chapters.ts"),

  // Better Auth catch-all
  route("api/auth/*", "routes/api.auth.$.ts"),

  // admin — login is OUTSIDE the gated layout; everything under admin.tsx is gated by its
  // middleware (one check for the whole subtree).
  route("admin/login", "routes/admin.login.tsx"),
  route("admin", "routes/admin.tsx", [
    index("routes/admin._index.tsx"),
    route("logout", "routes/admin.logout.tsx"),
    route("posts", "routes/admin.posts._index.tsx"),
    route("posts/:id", "routes/admin.posts.$id.tsx"),
    route("people", "routes/admin.people._index.tsx"),
    route("subscribers", "routes/admin.subscribers._index.tsx"),
    route("soundbites", "routes/admin.soundbites._index.tsx"),
    route("settings", "routes/admin.settings._index.tsx"),
    route("content/:key", "routes/admin.content.$key.tsx"),
    route("ai", "routes/admin.ai.ts"),
    route("upload", "routes/admin.upload.ts"),
    route("version/:vid", "routes/admin.version.$vid.ts"),
  ]),

  // tokenized "preview as published" — public but unguessable, noindex.
  route("preview/:id/:token", "routes/preview.$id.$token.tsx"),

  // episode/article detail — single dynamic segment, ranked below every static route above.
  route(":slug", "routes/$slug.tsx"),
] satisfies RouteConfig;
