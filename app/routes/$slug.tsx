import { useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { Headphones, Calendar, Clock } from "lucide-react";
import type { Route } from "./+types/$slug";
import { getEnv } from "~/lib/context.server";
import { getPostBySlug, relatedPosts } from "~/lib/posts.server";
import { toPlayerTrack, slugifyGuest } from "~/lib/posts";
import { getShowConfig } from "~/lib/show.server";
import { formatDate, formatDuration } from "~/lib/format";
import { Prose } from "~/components/content/Prose";
import { PlayButton } from "~/components/content/PlayButton";
import { PostCard } from "~/components/content/PostCard";
import { TranscriptPanel } from "~/components/content/TranscriptPanel";
import { ShareTimestamp } from "~/components/content/ShareTimestamp";
import { usePlayer } from "~/components/player/player-context";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData?.post) return [{ title: "Not found — germomics" }];
  const p = loaderData.post;
  const desc = p.seoDescription ?? p.excerpt ?? "";
  const image = p.episodeArtwork ?? p.coverImage ?? undefined;
  return [
    { title: `${p.seoTitle ?? p.title} — germomics` },
    { name: "description", content: desc },
    { property: "og:title", content: p.title },
    { property: "og:description", content: desc },
    { property: "og:type", content: p.kind === "episode" ? "music.song" : "article" },
    ...(image ? [{ property: "og:image", content: image }] : []),
  ];
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const post = await getPostBySlug(env, params.slug);
  if (!post) throw new Response("Not found", { status: 404 });
  const [related, show] = await Promise.all([relatedPosts(env, post), getShowConfig(env)]);
  return {
    post,
    track: post.kind === "episode" ? toPlayerTrack(post) : null,
    related,
    subscribeLinks: show.subscribeLinks ?? {},
  };
}

export default function Detail({ loaderData }: Route.ComponentProps) {
  const { post, track, related, subscribeLinks } = loaderData;
  const player = usePlayer();
  const [params] = useSearchParams();

  // Honor ?t=<seconds> deep links (share-at-timestamp landing).
  useEffect(() => {
    const t = Number(params.get("t"));
    if (track && t > 0) {
      if (player.current?.id === track.id) player.seek(t);
      else player.playTrackAt(track, t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isEpisode = post.kind === "episode";
  const guests = post.guests ?? [];
  const chapters = post.chapters ?? [];

  return (
    <article className="mx-auto max-w-3xl">
      <p className="font-mono text-xs uppercase tracking-wide text-accent">
        {isEpisode ? "Episode" : "Article"}
      </p>
      <h1 className="mt-2 font-display text-4xl font-semibold leading-tight">{post.title}</h1>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted">
        {isEpisode && post.episodeNumber ? <span>#{post.episodeNumber}</span> : null}
        {isEpisode && post.seasonNumber ? <span>Season {post.seasonNumber}</span> : null}
        {post.publishedAt ? (
          <span className="flex items-center gap-1">
            <Calendar size={12} aria-hidden /> {formatDate(post.publishedAt)}
          </span>
        ) : null}
        {isEpisode && post.audioDuration ? (
          <span className="flex items-center gap-1 tabular-nums">
            <Clock size={12} aria-hidden /> {formatDuration(post.audioDuration)}
          </span>
        ) : null}
      </div>

      {isEpisode && track ? (
        <div className="mt-6 flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
          <PlayButton track={track} size="lg" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 font-display text-sm text-brand">
              <Headphones size={14} aria-hidden /> Listen
            </span>
            <ShareTimestamp slug={post.slug} />
          </div>
        </div>
      ) : null}

      {post.body ? (
        <div className="mt-8">
          <Prose html={post.body} />
        </div>
      ) : null}

      {isEpisode && chapters.length ? (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-xl font-semibold">Chapters</h2>
          <ol className="grid gap-1">
            {chapters.map((c, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => (track && player.current?.id === track.id ? player.seek(c.start) : track && player.playTrackAt(track, c.start))}
                  className="flex w-full items-center gap-3 rounded px-2 py-1.5 text-left hover:bg-surface"
                >
                  <span className="font-mono text-xs tabular-nums text-accent">
                    {formatDuration(c.start)}
                  </span>
                  <span>{c.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {isEpisode && post.transcript && track ? (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-xl font-semibold">Transcript</h2>
          <TranscriptPanel transcript={post.transcript} track={track} />
        </section>
      ) : null}

      {guests.length ? (
        <section className="mt-10">
          <h2 className="mb-3 font-display text-xl font-semibold">Guests</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {guests.map((g, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <Link to={`/guests/${slugifyGuest(g.name)}`} className="font-display font-medium text-ink hover:text-brand">
                  {g.name}
                </Link>
                {g.role ? <p className="font-mono text-xs text-muted">{g.role}</p> : null}
                {g.bio ? <p className="mt-1 text-sm text-muted">{g.bio}</p> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {Object.keys(subscribeLinks).length ? (
        <section className="mt-10 rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-2 font-display text-sm font-semibold">Subscribe everywhere</h2>
          <div className="flex flex-wrap gap-3 font-mono text-xs">
            {Object.entries(subscribeLinks).map(([name, url]) => (
              <a key={name} href={url} className="hover:text-accent">
                {name}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {related.length ? (
        <section className="mt-12">
          <h2 className="mb-3 font-display text-xl font-semibold">Related</h2>
          <div className="grid gap-3">
            {related.map((r) => (
              <PostCard key={r.id} post={r} track={r.kind === "episode" ? toPlayerTrack(r) : undefined} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
