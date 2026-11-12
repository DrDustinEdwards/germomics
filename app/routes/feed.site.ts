// The writing feed (articles) for regular feed readers: Prelum's rssDocument. Each item keeps the guid stored at
// first publish, so a renamed article is not announced again (Grok audit 2026-10-21, GE-13).
import { FEED_CONTENT_TYPES, rssDocument } from "@drdustinedwards/site-helpers/feeds";
import { SITE_ORIGIN } from "~/lib/site";
import type { Route } from "./+types/feed.site";
import { getEnv } from "@dustinedwards/site-runtime/context";
import { listFullPosts } from "~/lib/posts.server";
import { getShowConfig } from "~/lib/show.server";

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
  // No Cache-Control: the Worker stores the feed at the edge under the pages tag, so a publish purges it (workers/app.ts
  // publicPages). Prelum's feedResponse would send its own hour and the feed would no longer be stored or purged.
  return new Response(xml, { headers: { "Content-Type": FEED_CONTENT_TYPES.rss } });
}
