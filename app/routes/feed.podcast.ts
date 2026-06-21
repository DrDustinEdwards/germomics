// The podcast feed. SACRED PATH: served at exactly /feed/podcast/ (with the trailing slash),
// the same URL every directory already polls — no redirect to/from a non-slash variant.
// Resource route: a loader returning a raw XML Response, no component.
import type { Route } from "./+types/feed.podcast";
import { getEnv } from "~/lib/context.server";
import { listEpisodes } from "~/lib/posts.server";
import { getShowConfig } from "~/lib/show.server";
import { buildPodcastFeed } from "~/lib/rss.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const origin = new URL(request.url).origin;
  const [show, episodes] = await Promise.all([getShowConfig(env), listEpisodes(env)]);
  const xml = buildPodcastFeed(show, episodes, origin);
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
