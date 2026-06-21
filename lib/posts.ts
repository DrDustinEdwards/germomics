// lib/posts.ts content queries over D1. One `posts` table; `kind` drives every listing.
// Episodes are canonical at /episodes/[slug] (matching the podcast feed <link>), articles
// at /writing/[slug].

import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { posts, type Post } from '@/db/schema';

export type Kind = 'episode' | 'article';

export function postHref(p: Pick<Post, 'kind' | 'slug'>): string {
  return p.kind === 'episode' ? `/episodes/${p.slug}` : `/writing/${p.slug}`;
}

/** Combined published feed, newest first. */
export function getPublished(limit = 50): Promise<Post[]> {
  return db
    .select()
    .from(posts)
    .where(eq(posts.status, 'published'))
    .orderBy(desc(posts.publishedAt))
    .limit(limit);
}

/** Published items of one kind, newest first. */
export function getByKind(kind: Kind, limit = 100): Promise<Post[]> {
  return db
    .select()
    .from(posts)
    .where(and(eq(posts.kind, kind), eq(posts.status, 'published')))
    .orderBy(desc(posts.publishedAt))
    .limit(limit);
}

/** A single published post by slug, or undefined. */
export async function getBySlug(slug: string): Promise<Post | undefined> {
  const rows = await db
    .select()
    .from(posts)
    .where(and(eq(posts.slug, slug), eq(posts.status, 'published')))
    .limit(1);
  return rows[0];
}

/** Published posts carrying a given tag (small dataset; filtered in app code). */
export async function getByTag(tag: string): Promise<Post[]> {
  const all = await getPublished(500);
  const want = tag.toLowerCase();
  return all.filter((p) => (p.tags ?? []).some((t) => t.toLowerCase() === want));
}

/** Published episodes featuring a guest, matched by slugified name. */
export async function getByGuest(guestSlug: string): Promise<{ name: string; posts: Post[] }> {
  const { slugify } = await import('@/lib/format');
  const episodes = await getByKind('episode', 500);
  let name = guestSlug;
  const matched = episodes.filter((p) =>
    (p.guests ?? []).some((g) => {
      if (slugify(g.name) === guestSlug) {
        name = g.name;
        return true;
      }
      return false;
    }),
  );
  return { name, posts: matched };
}

/** Full-text search across published posts via the live FTS5 virtual table. */
export function search(query: string, limit = 30): Promise<Post[]> {
  return db.all<Post>(sql`
    SELECT p.* FROM posts_fts f
    JOIN posts p ON p.id = f.rowid
    WHERE posts_fts MATCH ${query} AND p.status = 'published'
    ORDER BY rank
    LIMIT ${limit}
  `);
}
