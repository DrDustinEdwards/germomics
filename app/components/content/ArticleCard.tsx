import { AppLink } from "~/components/AppLink";
import { Calendar } from "lucide-react";
import { formatDate } from "~/lib/format";
import type { Post } from "~/db/schema";
import type { ImageAttributes } from "~/lib/images";
import { Picture } from "./Picture";

// Editorial card for the writing index: cover image, title, excerpt, date, reading time, tags.
export function ArticleCard({ post, image }: { post: Post; image?: ImageAttributes }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:border-brand">
      <AppLink to={`/${post.slug}`} className="block">
        {post.coverImage ? (
          <Picture
            src={post.coverImage}
            image={image}
            loading="lazy"
            decoding="async"
            alt={post.coverAlt ?? ""}
            className="aspect-[2/1] w-full border-b border-border object-cover"
          />
        ) : null}
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-wide text-muted">
            {post.publishedAt ? (
              <span className="flex items-center gap-1"><Calendar size={11} aria-hidden /> {formatDate(post.publishedAt)}</span>
            ) : null}
            {post.readingTime ? (
              <span className="tabular-nums">{post.readingTime} min read</span>
            ) : null}
          </div>
          <h3 className="mt-1.5 font-display text-xl font-semibold text-ink group-hover:text-brand">{post.title}</h3>
          {post.excerpt ? <p className="mt-1.5 line-clamp-2 text-sm text-muted">{post.excerpt}</p> : null}
        </div>
      </AppLink>
      {(post.tags ?? []).length ? (
        <div className="flex flex-wrap gap-1.5 px-4 pb-4">
          {(post.tags ?? []).slice(0, 4).map((t) => (
            <AppLink
              key={t}
              to={`/tag/${encodeURIComponent(t)}`}
              className="rounded-full border border-border px-2 py-0.5 font-mono text-[11px] text-muted hover:border-brand hover:text-brand"
            >
              {t}
            </AppLink>
          ))}
        </div>
      ) : null}
    </article>
  );
}
