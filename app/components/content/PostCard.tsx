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
    <article className="cap-card gm-post-card">
      <span className="cap-card-lead">
        {isEpisode && track ? (
          <PlayTrackButton track={track} queue={queue} />
        ) : (
          <span className="gm-post-card-icon">
            <FileText size={18} aria-hidden />
          </span>
        )}
      </span>
      <header>
        <div className="gm-post-card-meta">
          <span className="gm-post-card-kind">
            {isEpisode ? <Headphones size={12} aria-hidden /> : <FileText size={12} aria-hidden />}
            {isEpisode ? "Episode" : "Article"}
          </span>
          {isEpisode && post.episodeNumber ? <span>#{post.episodeNumber}</span> : null}
          {post.publishedAt ? <span>{formatDate(post.publishedAt)}</span> : null}
          {isEpisode && post.audioDuration ? (
            <span className="gm-num">{timecode(post.audioDuration * 1000)}</span>
          ) : null}
          {post.readingTime ? <span className="gm-num">{post.readingTime} min read</span> : null}
        </div>
        <Heading className="gm-post-card-title">
          <Link to={`/${post.slug}`} className="cap-card-link gm-post-card-link">
            {post.title}
          </Link>
        </Heading>
      </header>
      {post.excerpt ? <p className="gm-post-card-excerpt">{post.excerpt}</p> : null}
      {tags.length ? (
        <footer className="gm-post-card-foot">
          <ul className="gm-tags" aria-label="Tags">
            {tags.map((t) => (
              <li key={t}>
                <Link to={`/tag/${encodeURIComponent(t)}`} className="gm-tag">
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
