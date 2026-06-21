import Link from 'next/link';
import { Headphones, FileText } from 'lucide-react';
import type { Post } from '@/db/schema';
import { postHref } from '@/lib/posts';
import { hms, longDate } from '@/lib/format';

export default function PostCard({ post }: { post: Post }) {
  const isEpisode = post.kind === 'episode';
  return (
    <article className="group relative rounded-2xl border border-border bg-card p-5 transition-colors hover:border-border-strong">
      <div className="flex items-center gap-2 font-mono text-xs text-text-tertiary">
        {isEpisode ? <Headphones size={14} aria-hidden /> : <FileText size={14} aria-hidden />}
        <span className="uppercase tracking-wider">{isEpisode ? 'Episode' : 'Writing'}</span>
        {isEpisode && post.episodeNumber ? <span>· No. {post.episodeNumber}</span> : null}
        {post.publishedAt ? <span>· {longDate(post.publishedAt)}</span> : null}
        {isEpisode && post.audioDuration ? <span>· {hms(post.audioDuration)}</span> : null}
      </div>

      <h3 className="mt-2 font-display text-xl font-medium leading-snug text-text-primary">
        <Link href={postHref(post)} className="after:absolute after:inset-0">
          {post.title}
        </Link>
      </h3>

      {post.excerpt ? (
        <p className="mt-2 line-clamp-2 text-[0.95rem] text-text-secondary">{post.excerpt}</p>
      ) : null}
    </article>
  );
}
