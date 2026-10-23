// The writing feed (articles) for regular feed readers. Resource route → raw XML.
import type { Route } from "./+types/feed.site";
import { getEnv } from "~/lib/context.server";
import { listFullPosts } from "~/lib/posts.server";
import { getShowConfig } from "~/lib/show.server";
import { buildSiteFeed } from "~/lib/rss.server";
import { FEED_CACHE_CONTROL } from "~/lib/edge-cache.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const origin = new URL(request.url).origin;
  const [show, articles] = await Promise.all([getShowConfig(env), listFullPosts(env, "article")]);
  const xml = buildSiteFeed(show, articles, origin);
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": FEED_CACHE_CONTROL,
    },
  });
}
