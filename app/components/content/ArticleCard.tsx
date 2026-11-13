import { Link } from "capsomer/react/link";
import { Calendar } from "lucide-react";
import { formatDate } from "capsomer/behavior/time";
import type { Post } from "~/db/schema";
import type { ImageAttributes } from "~/lib/images";
import { Picture } from "capsomer/react/picture";
import { imageOrPlain } from "~/lib/images";

// Editorial card for the writing index: cover image, title, excerpt, date, reading time, tags. The title is an h2, right
// under the index's h1.
export function ArticleCard({ post, image }: { post: Post; image?: ImageAttributes }) {
  return (
    <article className="group gm-article-card">
      <Link to={`/${post.slug}`} className="block">
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
                <Calendar size={11} aria-hidden /> {formatDate(post.publishedAt)}
              </span>
            ) : null}
            {post.readingTime ? <span className="gm-num">{post.readingTime} min read</span> : null}
          </div>
          <h2 className="gm-article-card-title">{post.title}</h2>
          {post.excerpt ? <p className="gm-article-card-excerpt">{post.excerpt}</p> : null}
        </div>
      </Link>
      {(post.tags ?? []).length ? (
        <div className="gm-article-card-tags">
          {(post.tags ?? []).slice(0, 4).map((t) => (
            <Link key={t} to={`/tag/${encodeURIComponent(t)}`} className="gm-tag">
              {t}
            </Link>
          ))}
        </div>
      ) : null}
    </article>
  );
}
