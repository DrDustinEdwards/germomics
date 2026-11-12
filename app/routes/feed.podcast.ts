// The podcast feed. SACRED PATH: served at exactly /feed/podcast/ (with the trailing slash),
// the same URL every directory already polls — no redirect to/from a non-slash variant.
// Resource route: a loader returning a raw XML Response, no component.
import { FEED_CONTENT_TYPES } from "@drdustinedwards/site-helpers/feeds";
import { SITE_ORIGIN } from "~/lib/site";
import type { Route } from "./+types/feed.podcast";
import type { GuestView } from "~/lib/types";
import { getEnv } from "@dustinedwards/site-runtime/context";
import { listFullPosts } from "~/lib/posts.server";
import { getEpisodeGuests } from "~/lib/people.server";
import { soundbitesByEpisode } from "~/lib/soundbites.server";
import { getShowConfig } from "~/lib/show.server";
import { buildPodcastFeed } from "~/lib/rss.server";

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
  // No Cache-Control: the Worker stores the feed at the edge under the pages tag, so a publish purges it (workers/app.ts
  // publicPages). Prelum's feedResponse would send its own hour and the feed would no longer be stored or purged.
  return new Response(xml, { headers: { "Content-Type": FEED_CONTENT_TYPES.rss } });
}
