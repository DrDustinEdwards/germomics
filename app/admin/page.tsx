import Link from 'next/link';
import { desc } from 'drizzle-orm';
import { Plus, LogOut } from 'lucide-react';
import { db } from '@/lib/db';
import { posts } from '@/db/schema';
import { longDate } from '@/lib/format';
import { signOutAction } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const all = await db.select().from(posts).orderBy(desc(posts.updatedAt)).limit(200);

  return (
    <div className="py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary">
          Library
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/new?kind=episode"
            className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 font-display text-sm font-medium text-on-accent"
          >
            <Plus size={16} aria-hidden /> Episode
          </Link>
          <Link
            href="/admin/new?kind=article"
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 font-display text-sm text-text-primary"
          >
            <Plus size={16} aria-hidden /> Article
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              aria-label="Sign out"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border text-text-secondary hover:text-text-primary"
            >
              <LogOut size={16} aria-hidden />
            </button>
          </form>
        </div>
      </div>

      <ul className="mt-8 divide-y divide-border rounded-2xl border border-border">
        {all.length ? (
          all.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/posts/${p.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-surface"
              >
                <span className="min-w-0">
                  <span className="block truncate font-display text-text-primary">{p.title || 'Untitled'}</span>
                  <span className="font-mono text-xs text-text-tertiary">
                    {p.kind} · {p.status}
                    {p.updatedAt ? ` · ${longDate(p.updatedAt)}` : ''}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-1 font-mono text-[10px] uppercase ${
                    p.status === 'published' ? 'bg-accent text-on-accent' : 'border border-border text-text-tertiary'
                  }`}
                >
                  {p.status}
                </span>
              </Link>
            </li>
          ))
        ) : (
          <li className="px-5 py-8 text-center text-text-secondary">Nothing yet. Create the first post.</li>
        )}
      </ul>
    </div>
  );
}
