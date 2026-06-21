import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBySlug } from '@/lib/posts';
import { longDate } from '@/lib/format';
import { pageMetadata } from '@/lib/metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBySlug(slug);
  if (!post) return {};
  return pageMetadata({
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.excerpt ?? undefined,
    path: `/writing/${slug}`,
    image: post.coverImage ?? undefined,
  });
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBySlug(slug);
  if (!post || post.kind !== 'article') notFound();

  return (
    <article className="py-12">
      <p className="font-mono text-xs uppercase tracking-wider text-text-tertiary">
        Writing{post.publishedAt ? ` · ${longDate(post.publishedAt)}` : ''}
      </p>
      <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight text-text-primary">
        {post.title}
      </h1>

      {post.body ? (
        <div
          className="mt-10 max-w-2xl leading-relaxed text-text-primary [&_a]:text-accent [&_a]:underline-offset-4 hover:[&_a]:underline [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_p]:mt-4"
          dangerouslySetInnerHTML={{ __html: post.body }}
        />
      ) : null}

      {post.tags?.length ? (
        <div className="mt-10 flex flex-wrap gap-2">
          {post.tags.map((t) => (
            <Link
              key={t}
              href={`/tag/${encodeURIComponent(t)}`}
              className="rounded-full border border-border px-3 py-1 font-mono text-xs text-text-secondary hover:text-text-primary"
            >
              {t}
            </Link>
          ))}
        </div>
      ) : null}
    </article>
  );
}
