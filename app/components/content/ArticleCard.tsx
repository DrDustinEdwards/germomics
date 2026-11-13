import { Link } from "capsomer/react/link";
import { Icon, iconCalendar } from "capsomer/react/icons";
import { formatDate } from "capsomer/behavior/time";
import type { Post } from "~/db/schema";
import type { ImageAttributes } from "~/lib/images";
import { Picture } from "capsomer/react/picture";
import { imageOrPlain } from "~/lib/images";

// Editorial card for the writing index: cover image, title, excerpt, date, reading time, tags. The title is an h2, right
// under the index's h1.
export function ArticleCard({ post, image }: { post: Post; image?: ImageAttributes }) {
  return (
    <article className="gm-article-card">
      <Link to={`/${post.slug}`} className="gm-article-card-link">
        {post.coverImage ? (
          <Picture
            attrs={imageOrPlain(image, post.coverImage)}
            alt={post.coverAlt ?? ""}
            className="gm-article-card-image"
          />
        ) : null}
        <div className="gm-article-card-body">
          <div className="gm-article-card-meta">
            {post.publishedAt ? (
              <span className="gm-article-card-kind">
                <Icon d={iconCalendar} /> {formatDate(post.publishedAt)}
              </span>
            ) : null}
            {post.readingTime ? <span className="gm-num">{post.readingTime} min read</span> : null}
          </div>
          <h2 className="gm-article-card-title">{post.title}</h2>
          {post.excerpt ? <p className="gm-article-card-excerpt">{post.excerpt}</p> : null}
        </div>
      </Link>
      <TagLinks tags={(post.tags ?? []).slice(0, 4)} className="gm-article-card-tags" />
    </article>
  );
}

// A post's tags as pills linking to each tag's page; nothing when it has none. Used by the card and the post page.
export function TagLinks({ tags, className }: { tags: string[]; className: string }) {
  if (!tags.length) return null;
  return (
    <div className={className}>
      {tags.map((t) => (
        <Link key={t} to={`/tag/${encodeURIComponent(t)}`} className="gm-tag">
          {t}
        </Link>
      ))}
    </div>
  );
}
