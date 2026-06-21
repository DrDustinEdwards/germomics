import type { Route } from "./+types/guests.$guest";
import { getEnv } from "~/lib/context.server";
import { postsByGuest, slugifyGuest, toPlayerTrack } from "~/lib/posts.server";
import { PostCard } from "~/components/content/PostCard";
import { QueueSeeder } from "~/components/content/QueueSeeder";

export function meta({ loaderData }: Route.MetaArgs) {
  return [{ title: `${loaderData?.name ?? "Guest"} — germomics` }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const episodes = await postsByGuest(getEnv(context), params.guest);
  // Recover a display name + bio from the first matching episode's guest entry.
  const guest = episodes
    .flatMap((e) => e.guests ?? [])
    .find((g) => slugifyGuest(g.name) === params.guest);
  return {
    name: guest?.name ?? params.guest,
    bio: guest?.bio ?? null,
    episodes,
    tracks: episodes.map(toPlayerTrack),
  };
}

export default function GuestPage({ loaderData }: Route.ComponentProps) {
  const { name, bio, episodes, tracks } = loaderData;
  return (
    <div>
      <QueueSeeder tracks={tracks} />
      <p className="font-mono text-xs uppercase tracking-wide text-accent">Guest</p>
      <h1 className="mb-2 font-display text-3xl font-semibold">{name}</h1>
      {bio ? <p className="mb-6 max-w-2xl text-muted">{bio}</p> : null}
      <div className="grid gap-3">
        {episodes.map((post) => (
          <PostCard key={post.id} post={post} track={tracks.find((t) => t.id === post.id)} queue={tracks} />
        ))}
        {episodes.length === 0 ? <p className="text-muted">No episodes with this guest.</p> : null}
      </div>
    </div>
  );
}
