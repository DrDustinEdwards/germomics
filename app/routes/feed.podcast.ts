// The podcast feed. SACRED PATH: served at exactly /feed/podcast/ (with the trailing slash),
// the same URL every directory already polls — no redirect to/from a non-slash variant.
// Resource route: a loader returning a raw XML Response, no component.
import { SITE_ORIGIN } from "~/lib/site";
import type { Route } from "./+types/feed.podcast";
import type { GuestView } from "~/lib/types";
import { getEnv } from "~/lib/context.server";
import { listFullPosts } from "~/lib/posts.server";
import { getEpisodeGuests } from "~/lib/people.server";
import { soundbitesByEpisode } from "~/lib/soundbites.server";
import { getShowConfig } from "~/lib/show.server";
import { buildPodcastFeed } from "~/lib/rss.server";
import { FEED_CACHE_CONTROL } from "~/lib/edge-cache.server";

export async function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const [show, episodes, clips] = await Promise.all([
    getShowConfig(env),
    // Full rows: items carry the show notes and point at the transcript.
    listFullPosts(env, "episode"),
    soundbitesByEpisode(env),
  ]);
  // Resolve guests (people links, legacy-JSON fallback) per episode for <podcast:person>.
  const guestsByEpisode = new Map<number, GuestView[]>();
  await Promise.all(
    episodes.map(async (e) => guestsByEpisode.set(e.id, await getEpisodeGuests(env, e))),
  );
  const xml = buildPodcastFeed(show, episodes, SITE_ORIGIN, guestsByEpisode, clips);
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": FEED_CACHE_CONTROL,
    },
  });
}
