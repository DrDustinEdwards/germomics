// Post queries — the single place route loaders read content. Drizzle query builder only
// (CLAUDE.md rule #4); the one raw statement is the FTS5 MATCH, which Drizzle's DSL can't
// express. Tag/guest filters parse the JSON columns in JS (the catalog is small), keeping
// everything type-safe and camelCase.
import { and, asc, desc, eq, getTableColumns, gt, inArray, isNull, lte, min, or, sql, type SQL } from "drizzle-orm";
import { toMatchExpression } from "@drdustinedwards/site-helpers/search";
import { getDb } from "~/db/index.server";
import { postRedirects, posts, type Post } from "~/db/schema";
import { slugifyGuest, toPlayerTrack } from "~/lib/posts";
import { storedBody } from "~/lib/render.server";

// Re-export the client-safe pure helpers so existing server callers keep working.
export { slugifyGuest, toPlayerTrack };

type Kind = "episode" | "article";

// Card projection for LISTING queries: every posts column except the heavy text we never render in a
// list. body and full transcript are huge, and audioPeaks is the waveform array; none of them belong
// in a listing payload. chapters and guests stay (the player queue and the guests page read them) and
// are tiny next to body/transcript. Only the single post route (getPostBySlug/getPostById) loads the
// full body and transcript. Rows come back with the heavy fields re-added as empty so the Post type
// (and any consumer that reads those keys) stays intact, but nothing heavy is fetched or serialized.
const {
  body: _body,
  bodyHtml: _bodyHtml,
  bodyMeta: _bodyMeta,
  transcript: _transcript,
  audioPeaks: _peaks,
  sources: _sources,
  keyMoments: _km,
  ...cardColumns
} = getTableColumns(posts);
// readingTime stays in the projection: listing cards show it without loading the body.

function asCards(
  rows: Array<Omit<Post, "body" | "bodyHtml" | "bodyMeta" | "transcript" | "audioPeaks" | "sources" | "keyMoments">>,
): Post[] {
  return rows.map(
    (r) => ({ ...r, body: "", bodyHtml: null, bodyMeta: null, transcript: null, audioPeaks: null, sources: null, keyMoments: null }) as Post,
  );
}

// Publish-on-read scheduling gate (the mechanism chosen this pass — see the editor spec §F):
// a post is publicly visible when it is published AND not scheduled into the future. A
// "scheduled" post is status=published with a future publishAt; it stays hidden from every
// public read (lists, detail, search, feeds) until publishAt passes — no cron required. A post in
// Carrel's trash is a draft already; trashedAt is checked as well, so no stray row can show one.
function publiclyVisible(): SQL {
  const now = new Date().toISOString();
  return and(
    eq(posts.status, "published"),
    isNull(posts.trashedAt),
    or(isNull(posts.publishAt), lte(posts.publishAt, now)),
  )!;
}

/** When the next scheduled post goes live: it needs no write, so no purge, and a stored page stays fresh no later. */
export async function nextPublishAt(env: Env): Promise<Date | null> {
  const [row] = await getDb(env)
    .select({ at: min(posts.publishAt) })
    .from(posts)
    .where(and(eq(posts.status, "published"), gt(posts.publishAt, new Date().toISOString())));
  return row?.at ? new Date(row.at) : null;
}

/** In-JS mirror of publiclyVisible() for single rows already fetched. */
export function isVisibleNow(post: Post): boolean {
  return (
    post.status === "published" &&
    !post.trashedAt &&
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
  const rows = await db
    .select(cardColumns)
    .from(posts)
    .where(and(...where))
    .orderBy(desc(posts.publishedAt))
    .limit(opts.limit ?? 200);
  return asCards(rows);
}

/**
 * Visible posts of one kind with every column, newest first, each with its rendered body in bodyHtml. For the
 * readers that print the body or the transcript (the podcast and writing feeds, llms-full.txt), which print
 * HTML or plain text, never the Markdown; listing pages use listPosts' cards.
 */
export async function listFullPosts(env: Env, kind: Kind, limit = 200): Promise<Post[]> {
  const rows = await getDb(env)
    .select()
    .from(posts)
    .where(and(publiclyVisible(), eq(posts.kind, kind)))
    .orderBy(desc(posts.publishedAt))
    .limit(limit);
  return Promise.all(rows.map(async (p) => ({ ...p, bodyHtml: (await storedBody(env, p)).html })));
}

export const listEpisodes = (env: Env, limit?: number) =>
  listPosts(env, { kind: "episode", limit });

/** Distinct published episode season numbers, newest first (for the season nav + listing). */
export async function listSeasons(env: Env): Promise<number[]> {
  const rows = await getDb(env)
    .selectDistinct({ season: posts.seasonNumber })
    .from(posts)
    .where(and(publiclyVisible(), eq(posts.kind, "episode")));
  return rows
    .map((r) => r.season)
    .filter((s): s is number => s != null)
    .sort((a, b) => b - a);
}

/** Episodes in one season, ascending by episode number (so a listener can start at #1). */
export async function episodesInSeason(env: Env, season: number): Promise<Post[]> {
  const rows = await getDb(env)
    .select(cardColumns)
    .from(posts)
    .where(and(publiclyVisible(), eq(posts.kind, "episode"), eq(posts.seasonNumber, season)))
    .orderBy(asc(posts.episodeNumber));
  return asCards(rows);
}
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

/**
 * The permanent redirect for a slug a post was renamed from (Carrel's rename, post_redirects), to the same `suffix`
 * under the slug it has now; null when the slug was never renamed or the post is not publicly visible, so a redirect
 * never names a draft's address.
 */
export async function renamedPostRedirect(env: Env, slug: string, suffix = ""): Promise<Response | null> {
  const [row] = await getDb(env)
    .select({ slug: posts.slug })
    .from(postRedirects)
    .innerJoin(posts, eq(posts.id, postRedirects.postId))
    .where(and(eq(postRedirects.fromSlug, slug), publiclyVisible()))
    .limit(1);
  return row ? new Response(null, { status: 301, headers: { Location: `/${row.slug}${suffix}` } }) : null;
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

// adjacentPosts and relatedPosts work on one listPosts(env) result, so the post page reads the list
// once, in the same round trip as the post itself.

/** Previous / next published post of the same kind, by publish date (for article/episode nav). */
export function adjacentPosts(visible: Post[], post: Post): { prev: Post | null; next: Post | null } {
  const all = visible.filter((p) => p.kind === post.kind); // newest-first, visible only
  const i = all.findIndex((p) => p.id === post.id);
  if (i === -1) return { prev: null, next: null };
  return { prev: all[i + 1] ?? null, next: all[i - 1] ?? null }; // older = prev, newer = next
}

/** Related = same-kind posts sharing the most tags, newest first. */
export function relatedPosts(visible: Post[], post: Post, limit = 3): Post[] {
  const tags = new Set(post.tags ?? []);
  return visible
    .filter((p) => p.kind === post.kind && p.id !== post.id)
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
    .select(cardColumns)
    .from(posts)
    .where(and(publiclyVisible(), inArray(posts.id, ids)));
  const order = new Map(ids.map((id, i) => [id, i]));
  return asCards(found.sort((a, b) => (order.get(a.id)! - order.get(b.id)!)));
}

// FTS5 has its own query syntax. Punctuation becomes a space, then every word is a quoted
// literal (Prelum's toMatchExpression), all ANDed, the last one also matching as a prefix.
// Site search over pages (content.server) builds its MATCH here too.
export function toFtsMatch(raw: string): string | null {
  const terms = raw.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  return toMatchExpression({ terms }, true);
}

