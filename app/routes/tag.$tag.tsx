import type { Route } from "./+types/tag.$tag";
import { getEnv } from "~/lib/context.server";
import { postsByTag, toPlayerTrack } from "~/lib/posts.server";
import { PostCard } from "~/components/content/PostCard";
import { QueueSeeder } from "~/components/content/QueueSeeder";

export function meta({ params }: Route.MetaArgs) {
  return [{ title: `#${params.tag} · germomics` }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const items = await postsByTag(getEnv(context), params.tag);
  return { tag: params.tag, items, tracks: items.filter((p) => p.kind === "episode").map(toPlayerTrack) };
}

export default function TagPage({ loaderData }: Route.ComponentProps) {
  const { tag, items, tracks } = loaderData;
  return (
    <div>
      <QueueSeeder tracks={tracks} />
      <p className="font-mono text-xs uppercase tracking-wide text-accent">Tag</p>
      <h1 className="mb-6 font-display text-3xl font-semibold">#{tag}</h1>
      <div className="grid gap-3">
        {items.map((post) => (
          <PostCard key={post.id} post={post} track={tracks.find((t) => t.id === post.id)} queue={tracks} />
        ))}
        {items.length === 0 ? <p className="text-muted">No posts tagged “{tag}”.</p> : null}
      </div>
    </div>
  );
}
