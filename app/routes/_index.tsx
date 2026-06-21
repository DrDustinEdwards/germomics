import { Link } from "react-router";
import { Headphones } from "lucide-react";
import type { Route } from "./+types/_index";
import { getEnv } from "~/lib/context.server";
import { listEpisodes, listPosts, toPlayerTrack } from "~/lib/posts.server";
import { formatDate, formatDuration } from "~/lib/format";
import { PostCard } from "~/components/content/PostCard";
import { PlayButton } from "~/components/content/PlayButton";
import { QueueSeeder } from "~/components/content/QueueSeeder";

export function meta() {
  return [
    { title: "germomics — microbiology & history" },
    {
      name: "description",
      content:
        "A podcast and writing project about microbiology and history — audio, transcripts, writing, data, and games.",
    },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const [episodes, combined] = await Promise.all([
    listEpisodes(env),
    listPosts(env, { limit: 24 }),
  ]);
  const tracks = episodes.map(toPlayerTrack);
  return { featured: episodes[0] ?? null, items: combined, tracks };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { featured, items, tracks } = loaderData;
  const featuredTrack = tracks.find((t) => t.id === featured?.id);

  return (
    <div className="space-y-12">
      <QueueSeeder tracks={tracks} />

      <section className="pt-6">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          The purple stain, retold
        </p>
        <h1 className="mt-3 max-w-3xl font-display text-5xl font-semibold leading-[1.05] sm:text-6xl">
          Microbiology &amp; history, <span className="text-brand">in your ears</span>.
        </h1>
        {featured && featuredTrack ? (
          <div className="mt-8 flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
            <PlayButton track={featuredTrack} queue={tracks} size="lg" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wide text-muted">
                <span className="flex items-center gap-1 text-brand">
                  <Headphones size={12} aria-hidden /> Latest episode
                </span>
                {featured.publishedAt ? <span>{formatDate(featured.publishedAt)}</span> : null}
                {featured.audioDuration ? (
                  <span className="tabular-nums">{formatDuration(featured.audioDuration)}</span>
                ) : null}
              </div>
              <h2 className="mt-1 truncate font-display text-xl font-medium">
                <Link to={`/${featured.slug}`} className="hover:text-brand">
                  {featured.title}
                </Link>
              </h2>
            </div>
          </div>
        ) : null}
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-semibold">Latest</h2>
          <Link to="/archive" className="font-mono text-xs text-accent hover:underline">
            view all →
          </Link>
        </div>
        <div className="grid gap-3">
          {items.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              track={tracks.find((t) => t.id === post.id)}
              queue={tracks}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
