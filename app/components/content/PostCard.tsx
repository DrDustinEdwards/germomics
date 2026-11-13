import { Link } from "capsomer/react/link";
import { Headphones, FileText } from "lucide-react";
import { formatDate, timecode } from "capsomer/behavior/time";
import { PlayTrackButton } from "capsomer/react/player";
import type { Post } from "~/db/schema";
import type { PlayerTrack } from "~/lib/types";

// A single content card for listings, on Capsomer's card: the title is the card's one destination
// (a stretched link, so the whole card goes to the post), the play button or read icon is the card's
// lead, and the tags are its own links in the footer. Episodes get a play button (their track is the
// one in `queue` with the post's id); articles get a read icon. `heading` is h2 on a page where the
// cards sit right under the h1, h3 under a section's h2. The look is germomics' own classes, which
// win over Capsomer's layer.
export function PostCard({
  post,
  queue,
  heading: Heading = "h3",
}: {
  post: Post;
  queue?: PlayerTrack[];
  heading?: "h2" | "h3";
}) {
  const isEpisode = post.kind === "episode";
  const track = queue?.find((t) => t.id === post.id);
  const tags = (post.tags ?? []).slice(0, 4);
  return (
    <article className="cap-card gap-x-4 gap-y-0 rounded-xl border border-border bg-card p-4 text-ink">
      <span className="cap-card-lead">
        {isEpisode && track ? (
          <PlayTrackButton track={track} queue={queue} />
        ) : (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-brand">
            <FileText size={18} aria-hidden />
          </span>
        )}
      </span>
      <header>
        <div className="mt-0 flex flex-wrap items-center gap-x-2 font-mono text-[0.6875rem] uppercase tracking-wide text-muted">
          <span className="flex items-center gap-1 text-brand">
            {isEpisode ? <Headphones size={12} aria-hidden /> : <FileText size={12} aria-hidden />}
            {isEpisode ? "Episode" : "Article"}
          </span>
          {isEpisode && post.episodeNumber ? <span>#{post.episodeNumber}</span> : null}
          {post.publishedAt ? <span>{formatDate(post.publishedAt)}</span> : null}
          {isEpisode && post.audioDuration ? (
            <span className="tabular-nums">{timecode(post.audioDuration * 1000)}</span>
          ) : null}
          {post.readingTime ? (
            <span className="tabular-nums">{post.readingTime} min read</span>
          ) : null}
        </div>
        <Heading className="mt-1 font-display text-lg font-medium text-wrap">
          <Link to={`/${post.slug}`} className="cap-card-link text-ink hover:text-brand">
            {post.title}
          </Link>
        </Heading>
      </header>
      {post.excerpt ? <p className="mt-1 text-sm text-muted text-wrap">{post.excerpt}</p> : null}
      {tags.length ? (
        <footer className="mt-2 p-0">
          <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
            {tags.map((t) => (
              <li key={t}>
                <Link
                  to={`/tag/${encodeURIComponent(t)}`}
                  className="block rounded-full border border-border px-2 py-0.5 font-mono text-[0.6875rem] text-muted hover:border-brand hover:text-brand"
                >
                  {t}
                </Link>
              </li>
            ))}
          </ul>
        </footer>
      ) : null}
    </article>
  );
}
