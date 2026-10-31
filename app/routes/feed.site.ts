// The writing feed (articles) for regular feed readers: Prelum's rssDocument. Each item keeps the guid stored at
// first publish, so a renamed article is not announced again (Grok audit 2026-10-21, GE-13).
import { rssDocument } from "@drdustinedwards/site-helpers/feeds";
import { SITE_ORIGIN } from "~/lib/site";
import type { Route } from "./+types/feed.site";
import { getEnv } from "~/lib/context.server";
import { listFullPosts } from "~/lib/posts.server";
import { getShowConfig } from "~/lib/show.server";
import { FEED_CACHE_CONTROL } from "~/lib/edge-cache.server";

export async function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const [show, articles] = await Promise.all([getShowConfig(env), listFullPosts(env, "article")]);
  const xml = rssDocument({
    title: `${show.title}: Writing`,
    link: `${SITE_ORIGIN}/writing`,
    description: "Essays and notes from Germomics.",
    selfUrl: `${SITE_ORIGIN}/feed/site.xml`,
    origin: SITE_ORIGIN,
    itemPath: "",
    lastBuildDate: articles[0]?.publishedAt,
    posts: articles.map((a) => ({
      slug: a.slug,
      title: a.title,
      html: a.bodyHtml ?? "",
      description: a.excerpt,
      publishAt: a.publishedAt,
      tags: a.tags ?? [],
      guid: a.guid ?? undefined,
    })),
  });
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": FEED_CACHE_CONTROL,
    },
  });
}
