import type { Route } from "./+types/episodes._index";
import { getEnv } from "~/lib/context.server";
import { listEpisodes, toPlayerTrack } from "~/lib/posts.server";
import { PostCard } from "~/components/content/PostCard";
import { QueueSeeder } from "~/components/content/QueueSeeder";

export function meta() {
  return [
    { title: "Episodes — germomics" },
    { name: "description", content: "Every germomics episode, newest first." },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  const episodes = await listEpisodes(getEnv(context));
  return { episodes, tracks: episodes.map(toPlayerTrack) };
}

export default function Episodes({ loaderData }: Route.ComponentProps) {
  const { episodes, tracks } = loaderData;
  return (
    <div>
      <QueueSeeder tracks={tracks} />
      <h1 className="mb-6 font-display text-3xl font-semibold">Episodes</h1>
      <div className="grid gap-3">
        {episodes.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            track={tracks.find((t) => t.id === post.id)}
            queue={tracks}
          />
        ))}
        {episodes.length === 0 ? <p className="text-muted">No episodes yet.</p> : null}
      </div>
    </div>
  );
}
