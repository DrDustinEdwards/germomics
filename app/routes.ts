import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("routes/_site.tsx", [
    index("routes/_index.tsx"),

    route("episodes", "routes/episodes._index.tsx"),
    route("season/:num", "routes/season.$num.tsx"),
    route("writing", "routes/writing._index.tsx"),
    route("archive", "routes/archive.tsx"),
    route("search", "routes/search.tsx"),
    route("data", "routes/data._index.tsx"),
    route("data/:slug", "routes/data.$slug.tsx"),
    route("games", "routes/games._index.tsx"),
    route("games/:slug", "routes/games.$slug.tsx"),
    route("tag/:tag", "routes/tag.$tag.tsx"),
    route("guests/:guest", "routes/guests.$guest.tsx"),
    route("subscribe", "routes/subscribe.tsx"),
    route("subscribe/confirm", "routes/subscribe.confirm.tsx"),
    route("unsubscribe", "routes/unsubscribe.tsx"),
    route("about", "routes/about.tsx"),
    route("about/dustin-edwards", "routes/about.dustin-edwards.tsx"),
    route("privacy", "routes/privacy.tsx"),
    route("terms", "routes/terms.tsx"),
    route("accessibility", "routes/accessibility.tsx"),
    route("contact", "routes/contact.tsx"),
    route("txasm", "routes/txasm.tsx"),
    // Detail by slug. Also a catch-all, so an unknown /a/b reaches the loader's 404 inside this layout instead of the
    // root's bare error page. Ranked below every static route.
    route("*", "routes/$slug.tsx"),
  ]),
  route("games/assets/*", "routes/games.assets.$.ts"),
  route("media/*", "routes/media.$.ts"),

  route("health", "routes/health.ts"),
  // Capsid Admin's operator API: a bearer, not Access.
  route("api/operator", "routes/api.operator.ts"),

  // /feed/podcast/ is the immutable URL directories poll: no redirect to or from a non-slash variant.
  route("feed/podcast", "routes/feed.podcast.ts"),
  route("feed/site.xml", "routes/feed.site.ts"),

  route("sitemap.xml", "routes/sitemap.ts"),
  route("llms.txt", "routes/llms.ts"),
  route("llms-full.txt", "routes/llms-full.ts"),
  // Google Search Console ownership proof; removing it un-verifies the property.
  route("google7e6923f5a0eb8ba9.html", "routes/google-verification.ts"),

  route(":slug/transcript.vtt", "routes/transcript.ts"),
  route(":slug/chapters.json", "routes/chapters.ts"),

  // The Access drift check's admin list: under /admin so Access covers it, outside the layout because the caller is a service token.
  route("admin/access-drift", "routes/admin.access-drift.ts"),

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
  ]),

  // Carrel's /preview/<token> is answered by the Worker before the app (workers/app.ts).
] satisfies RouteConfig;
