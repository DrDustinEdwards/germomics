// /sitemap.xml — every publicly-visible post (respects publiclyVisible()/publish_at via
// listPosts) plus the key static pages. Resource route returning raw XML.
import type { Route } from "./+types/sitemap";
import { getEnv } from "~/lib/context.server";
import { listPosts, listSeasons } from "~/lib/posts.server";
import { isoDay } from "@drdustinedwards/site-helpers/xml";
import { sitemapDocument } from "@drdustinedwards/site-helpers/sitemap";

const STATIC_PATHS = [
  "",
  "episodes",
  "writing",
  "archive",
  "data",
  "games",
  "subscribe",
  "about",
  "about/dustin-edwards",
  "privacy",
  "terms",
  "contact",
  "txasm",
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const origin = new URL(request.url).origin;
  const [posts, seasons] = await Promise.all([
    listPosts(env, { limit: 1000 }), // visible only
    listSeasons(env),
  ]);

  const xml = sitemapDocument(
    [
      ...STATIC_PATHS.map((p) => ({ loc: `${origin}/${p}` })),
      ...seasons.map((s) => ({ loc: `${origin}/season/${s}` })),
      ...posts.map((post) => ({
        loc: `${origin}/${post.slug}`,
        lastmod: isoDay(post.updatedAt) ?? isoDay(post.publishedAt),
      })),
    ],
    { trailingNewline: false },
  );

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
