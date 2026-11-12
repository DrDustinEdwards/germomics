// /sitemap.xml — every publicly-visible post (respects publiclyVisible()/publish_at via
// listPosts) plus the key static pages. Resource route returning raw XML.
import { SITE_ORIGIN } from "~/lib/site";
import type { Route } from "./+types/sitemap";
import { getEnv } from "@dustinedwards/site-runtime/context";
import { listPostImages, listPosts, listSeasons } from "~/lib/posts.server";
import { isoDay } from "@drdustinedwards/site-helpers/xml";
import { sitemapDocument } from "@drdustinedwards/site-helpers/sitemap";
import { STATIC_PATHS, pageRecordStore } from "~/lib/page-dates.server";

export async function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const [posts, seasons, images, dates] = await Promise.all([
    listPosts(env, { limit: 1000 }), // visible only
    listSeasons(env),
    listPostImages(env),
    // The day each hub and static page last changed (the daily page-dates job); one it has not dated yet has no lastmod.
    pageRecordStore(env).load(),
  ]);
  const dated = (path: string) => ({
    loc: `${SITE_ORIGIN}${path}`,
    lastmod: dates?.[path]?.lastmod,
  });
  // An image sitemap entry is an absolute URL; a stored site path is made one.
  const absolute = (src: string) => new URL(src, SITE_ORIGIN).href;

  const xml = sitemapDocument(
    [
      ...STATIC_PATHS.map((p) => dated(`/${p}`)),
      ...seasons.map((s) => dated(`/season/${s}`)),
      ...posts
        .filter((post) => !post.noindex)
        .map((post) => ({
          loc: `${SITE_ORIGIN}/${post.slug}`,
          lastmod: isoDay(post.updatedAt) ?? isoDay(post.publishedAt),
          images: images.get(post.slug)?.map(absolute),
        })),
    ],
    { trailingNewline: false },
  );

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
}
