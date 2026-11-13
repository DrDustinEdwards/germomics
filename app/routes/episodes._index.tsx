import { pageHead } from "~/lib/seo";
import type { Route } from "./+types/episodes._index";
import { getEnv } from "@dustinedwards/site-runtime/context";
import { listEpisodes, toPlayerTrack } from "~/lib/posts.server";
import { PostCard } from "~/components/content/PostCard";
import { QueueSeeder } from "~/components/content/QueueSeeder";

export function meta() {
  return pageHead({
    path: "/episodes",
    title: "Episodes · Germomics",
    description:
      "Every episode of Germomics, the podcast about microbiology and history, grouped by season, with audio and a transcript for each.",
    pageType: "CollectionPage",
  });
}

export async function loader({ context }: Route.LoaderArgs) {
  // listEpisodes returns card-only rows (no body/transcript/peaks), so the payload stays light.
  const episodes = await listEpisodes(getEnv(context));
  const tracks = episodes.map(toPlayerTrack);
  return { episodes, tracks };
}

export default function Episodes({ loaderData }: Route.ComponentProps) {
  const { episodes, tracks } = loaderData;

  // Group by season (newest season first); within a season order ascending by episode number so a
  // new listener can start at #1. Episodes without a season trail in a plain group.
  const bySeason = new Map<number, typeof episodes>();
  const noSeason: typeof episodes = [];
  for (const e of episodes) {
    if (e.seasonNumber == null) noSeason.push(e);
    else {
      const arr = bySeason.get(e.seasonNumber) ?? [];
      arr.push(e);
      bySeason.set(e.seasonNumber, arr);
    }
  }
  const seasons = [...bySeason.keys()].sort((a, b) => b - a);
  const card = (post: (typeof episodes)[number]) => (
    <PostCard key={post.id} post={post} queue={tracks} />
  );

  return (
    <div>
      <QueueSeeder tracks={tracks} />
      <h1 className="gm-list-title">Episodes</h1>

      {seasons.map((s) => {
        const eps = bySeason
          .get(s)!
          .slice()
          .sort((a, b) => (a.episodeNumber ?? 0) - (b.episodeNumber ?? 0));
        return (
          <section key={s} id={`season-${s}`} className="gm-season-section">
            {/* Teal eyebrow divider (same style as /season/:num), one per season group. */}
            <h2 className="gm-season-heading">Season {s}</h2>
            <div className="gm-list">{eps.map(card)}</div>
          </section>
        );
      })}

      {noSeason.length ? (
        <section className="gm-episodes-section">
          <h2 className="gm-episodes-heading">More episodes</h2>
          <div className="gm-list">{noSeason.map(card)}</div>
        </section>
      ) : null}

      {episodes.length === 0 ? <p className="gm-muted">No episodes yet.</p> : null}
    </div>
  );
}
