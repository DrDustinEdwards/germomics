import Link from 'next/link';
import { getPublished } from '@/lib/posts';
import PostList from '@/components/PostList';
import { pageMetadata } from '@/lib/metadata';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata({ title: 'Archive', path: '/archive' });

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'episodes', label: 'Episodes' },
  { key: 'writing', label: 'Writing' },
] as const;

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab = 'all' } = await searchParams;
  const all = await getPublished(500);
  const posts =
    tab === 'episodes'
      ? all.filter((p) => p.kind === 'episode')
      : tab === 'writing'
        ? all.filter((p) => p.kind === 'article')
        : all;

  return (
    <div className="py-12">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-text-primary">
        Archive
      </h1>
      <div role="tablist" aria-label="Filter archive" className="mt-6 flex gap-1">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              role="tab"
              aria-selected={active}
              href={t.key === 'all' ? '/archive' : `/archive?tab=${t.key}`}
              className={`rounded-full px-4 py-2 font-display text-sm transition-colors ${
                active
                  ? 'bg-brand text-on-accent'
                  : 'border border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      <PostList posts={posts} empty="Nothing in the archive yet." />
    </div>
  );
}
