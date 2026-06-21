import Link from 'next/link';
import { Headphones } from 'lucide-react';
import { getPublished, postHref } from '@/lib/posts';
import { hms, longDate } from '@/lib/format';
import PostCard from '@/components/PostCard';
import { SITE_TAGLINE } from '@/lib/constants';

// Reads D1 at request time (native binding), so never statically prerendered.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const feed = await getPublished(30);
  const latestEpisode = feed.find((p) => p.kind === 'episode');
  const rest = feed.filter((p) => p.id !== latestEpisode?.id);

  return (
    <div className="py-12">
      <section className="border-b border-border pb-12">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          Microbiology &amp; history
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold leading-[1.03] tracking-tight text-text-primary sm:text-6xl">
          The <span className="text-brand">purple</span> stain.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-text-secondary">{SITE_TAGLINE}</p>

        {latestEpisode ? (
          <Link
            href={postHref(latestEpisode)}
            className="mt-8 flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-brand"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
              <Headphones size={20} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-mono text-xs uppercase tracking-wider text-text-tertiary">
                Latest episode
                {latestEpisode.publishedAt ? ` · ${longDate(latestEpisode.publishedAt)}` : ''}
                {latestEpisode.audioDuration ? ` · ${hms(latestEpisode.audioDuration)}` : ''}
              </span>
              <span className="mt-1 block truncate font-display text-lg font-medium text-text-primary">
                {latestEpisode.title}
              </span>
            </span>
          </Link>
        ) : null}
      </section>

      <section className="pt-10">
        <h2 className="font-display text-sm uppercase tracking-wider text-text-secondary">
          Latest
        </h2>
        {rest.length ? (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {rest.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <p className="mt-5 text-text-secondary">Nothing published yet.</p>
        )}
      </section>
    </div>
  );
}
