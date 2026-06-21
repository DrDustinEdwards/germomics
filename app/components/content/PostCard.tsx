import { Link } from "react-router";
import { Headphones, FileText } from "lucide-react";
import { formatDate, formatDuration } from "~/lib/format";
import { PlayButton } from "./PlayButton";
import type { Post } from "~/db/schema";
import type { PlayerTrack } from "~/lib/types";

// A single content card for listings. Episodes get a play button; articles get a read icon.
export function PostCard({
  post,
  track,
  queue,
}: {
  post: Post;
  track?: PlayerTrack;
  queue?: PlayerTrack[];
}) {
  const isEpisode = post.kind === "episode";
  return (
    <article className="flex gap-4 rounded-xl border border-border bg-card p-4">
      {isEpisode && track ? (
        <PlayButton track={track} queue={queue} />
      ) : (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-brand">
          <FileText size={18} aria-hidden />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wide text-muted">
          <span className="flex items-center gap-1 text-brand">
            {isEpisode ? <Headphones size={12} aria-hidden /> : <FileText size={12} aria-hidden />}
            {isEpisode ? "Episode" : "Article"}
          </span>
          {isEpisode && post.episodeNumber ? <span>#{post.episodeNumber}</span> : null}
          {post.publishedAt ? <span>{formatDate(post.publishedAt)}</span> : null}
          {isEpisode && post.audioDuration ? (
            <span className="tabular-nums">{formatDuration(post.audioDuration)}</span>
          ) : null}
        </div>
        <h3 className="mt-1 font-display text-lg font-medium">
          <Link to={`/${post.slug}`} className="text-ink hover:text-brand">
            {post.title}
          </Link>
        </h3>
        {post.excerpt ? (
          <p className="mt-1 line-clamp-2 text-sm text-muted">{post.excerpt}</p>
        ) : null}
        {(post.tags ?? []).length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(post.tags ?? []).slice(0, 4).map((t) => (
              <Link
                key={t}
                to={`/tag/${encodeURIComponent(t)}`}
                className="rounded-full border border-border px-2 py-0.5 font-mono text-[11px] text-muted hover:border-brand hover:text-brand"
              >
                {t}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
