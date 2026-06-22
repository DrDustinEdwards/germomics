// Post queries — the single place route loaders read content. Drizzle query builder only
// (CLAUDE.md rule #4); the one raw statement is the FTS5 MATCH, which Drizzle's DSL can't
// express. Tag/guest filters parse the JSON columns in JS (the catalog is small), keeping
// everything type-safe and camelCase.
import { and, desc, eq, inArray, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "~/db/index.server";
import { posts, type Post } from "~/db/schema";
import { slugifyGuest, toPlayerTrack } from "~/lib/posts";

// Re-export the client-safe pure helpers so existing server callers keep working.
export { slugifyGuest, toPlayerTrack };

type Kind = "episode" | "article";

// Publish-on-read scheduling gate (the mechanism chosen this pass — see the editor spec §F):
// a post is publicly visible when it is published AND not scheduled into the future. A
// "scheduled" post is status=published with a future publishAt; it stays hidden from every
// public read (lists, detail, search, feeds) until publishAt passes — no cron required.
export function publiclyVisible(): SQL {
  const now = new Date().toISOString();
  return and(
    eq(posts.status, "published"),
    or(isNull(posts.publishAt), lte(posts.publishAt, now)),
  )!;
}

/** In-JS mirror of publiclyVisible() for single rows already fetched. */
export function isVisibleNow(post: Post): boolean {
  return (
    post.status === "published" &&
    (!post.publishAt || post.publishAt <= new Date().toISOString())
  );
}

export async function listPosts(
  env: Env,
  opts: { kind?: Kind; limit?: number; featuredFirst?: boolean } = {},
): Promise<Post[]> {
  const db = getDb(env);
  const where = [publiclyVisible()];
  if (opts.kind) where.push(eq(posts.kind, opts.kind));
  return db
    .select()
    .from(posts)
    .where(and(...where))
    .orderBy(desc(posts.publishedAt))
    .limit(opts.limit ?? 200);
}

export const listEpisodes = (env: Env, limit?: number) =>
  listPosts(env, { kind: "episode", limit });
export const listArticles = (env: Env, limit?: number) =>
  listPosts(env, { kind: "article", limit });

export async function getPostBySlug(
  env: Env,
  slug: string,
  opts: { includeDrafts?: boolean } = {},
): Promise<Post | null> {
  const db = getDb(env);
  const rows = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
  const post = rows[0];
  if (!post) return null;
  if (!opts.includeDrafts && !isVisibleNow(post)) return null;
  return post;
}

export async function getPostById(env: Env, id: number): Promise<Post | null> {
  const db = getDb(env);
  const rows = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function postsByTag(env: Env, tag: string): Promise<Post[]> {
  const all = await listPosts(env);
  return all.filter((p) => (p.tags ?? []).includes(tag));
}

export async function postsByGuest(env: Env, guestSlug: string): Promise<Post[]> {
  const all = await listEpisodes(env);
  return all.filter((p) => (p.guests ?? []).some((g) => slugifyGuest(g.name) === guestSlug));
}

/** Previous / next published post of the same kind, by publish date (for article/episode nav). */
export async function adjacentPosts(
  env: Env,
  post: Post,
): Promise<{ prev: Post | null; next: Post | null }> {
  const all = await listPosts(env, { kind: post.kind as Kind }); // newest-first, visible only
  const i = all.findIndex((p) => p.id === post.id);
  if (i === -1) return { prev: null, next: null };
  return { prev: all[i + 1] ?? null, next: all[i - 1] ?? null }; // older = prev, newer = next
}

/** Related = same-kind posts sharing the most tags, newest first. */
export async function relatedPosts(env: Env, post: Post, limit = 3): Promise<Post[]> {
  const all = await listPosts(env, { kind: post.kind as Kind });
  const tags = new Set(post.tags ?? []);
  return all
    .filter((p) => p.id !== post.id)
    .map((p) => ({ p, score: (p.tags ?? []).filter((t) => tags.has(t)).length }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
}

/** Full-text search across both content types via the FTS5 mirror. */
export async function searchPosts(env: Env, rawQuery: string): Promise<Post[]> {
  const match = toFtsMatch(rawQuery);
  if (!match) return [];
  const db = getDb(env);
  const idRows = await db.all<{ id: number }>(
    sql`SELECT f.rowid AS id FROM posts_fts f WHERE posts_fts MATCH ${match} ORDER BY rank LIMIT 50`,
  );
  const ids = idRows.map((r) => r.id);
  if (!ids.length) return [];
  const found = await db
    .select()
    .from(posts)
    .where(and(publiclyVisible(), inArray(posts.id, ids)));
  const order = new Map(ids.map((id, i) => [id, i]));
  return found.sort((a, b) => (order.get(a.id)! - order.get(b.id)!));
}

// FTS5 has its own query syntax; strip punctuation that could be interpreted as operators and
// AND the remaining tokens (with a trailing prefix match on the last one).
function toFtsMatch(raw: string): string | null {
  const tokens = raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!tokens.length) return null;
  return tokens.map((t, i) => (i === tokens.length - 1 ? `${t}*` : t)).join(" ");
}

