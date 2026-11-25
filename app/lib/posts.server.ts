// Post queries: the one place route loaders read content. The only raw statement is the FTS5 MATCH; tag and guest
// filters parse the JSON columns in JS (the catalog is small).
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gt,
  inArray,
  isNull,
  lte,
  min,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { toMatchExpression } from "@drdustinedwards/site-helpers/search";
import { getDb } from "~/db/index.server";
import { postRedirects, posts, type Post } from "~/db/schema";
import { slugify } from "@drdustinedwards/site-helpers/slug";
import { storedBody } from "~/lib/render.server";

type Kind = "episode" | "article";

// Card projection for listings: every column except the heavy ones (body, transcript, audioPeaks, sources), re-added
// as empty so the Post type holds. chapters and guests stay: the player queue and the guests page read them.
const {
  body: _body,
  bodyHtml: _bodyHtml,
  bodyMeta: _bodyMeta,
  transcript: _transcript,
  audioPeaks: _peaks,
  sources: _sources,
  ...cardColumns
} = getTableColumns(posts);
// readingTime stays in the projection: listing cards show it without loading the body.

function asCards(
  rows: Array<
    Omit<Post, "body" | "bodyHtml" | "bodyMeta" | "transcript" | "audioPeaks" | "sources">
  >,
): Post[] {
  return rows.map(
    (r) =>
      ({
        ...r,
        body: "",
        bodyHtml: null,
        bodyMeta: null,
        transcript: null,
        audioPeaks: null,
        sources: null,
      }) as Post,
  );
}

// Publish-on-read gate: visible means published, publishAt not in the future, and not trashed. A scheduled post is
// status=published with a future publishAt, so it needs no cron to go live. trashedAt is checked too, so no stray row shows.
function publiclyVisible(): SQL {
  const now = new Date().toISOString();
  return and(
    eq(posts.status, "published"),
    isNull(posts.trashedAt),
    or(isNull(posts.publishAt), lte(posts.publishAt, now)),
  )!;
}

/** When the next scheduled post goes live: no write happens then, so a stored page must not outlive it. */
export async function nextPublishAt(env: Env): Promise<Date | null> {
  const [row] = await getDb(env)
    .select({ at: min(posts.publishAt) })
    .from(posts)
    .where(and(eq(posts.status, "published"), gt(posts.publishAt, new Date().toISOString())));
  return row?.at ? new Date(row.at) : null;
}

export function isVisibleNow(post: Post): boolean {
  return (
    post.status === "published" &&
    !post.trashedAt &&
    (!post.publishAt || post.publishAt <= new Date().toISOString())
  );
}

export async function listPosts(
  env: Env,
  opts: { kind?: Kind; limit?: number } = {},
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

/** Each visible post's cover and body <img>s for the image sitemap, read from the stored render, never re-rendered. data: URLs and the dark half of a themed pair are left out. */
export async function listPostImages(env: Env): Promise<Map<string, string[]>> {
  const rows = await getDb(env)
    .select({
      slug: posts.slug,
      coverImage: posts.coverImage,
      body: posts.body,
      bodyHtml: posts.bodyHtml,
      renderVersion: posts.renderVersion,
    })
    .from(posts)
    .where(publiclyVisible());
  const out = new Map<string, string[]>();
  for (const row of rows) {
    const html = row.renderVersion === null ? row.body : (row.bodyHtml ?? "");
    const found = new Set<string>(row.coverImage ? [row.coverImage] : []);
    for (const [tag] of html.matchAll(/<img\b[^>]*>/g)) {
      const src = /\ssrc="([^"]+)"/.exec(tag)?.[1];
      if (
        src &&
        !src.startsWith("data:") &&
        !/\bdark\b/.test(/\sclass="([^"]*)"/.exec(tag)?.[1] ?? "")
      )
        found.add(src.replace(/&amp;/g, "&"));
    }
    if (found.size > 0) out.set(row.slug, [...found]);
  }
  return out;
}

/** Visible posts of one kind, every column, newest first, with the rendered body in bodyHtml. For the feeds and llms-full.txt; listings use cards. */
export async function listFullPosts(env: Env, kind: Kind, limit = 200): Promise<Post[]> {
  const rows = await getDb(env)
    .select()
    .from(posts)
    .where(and(publiclyVisible(), eq(posts.kind, kind)))
    .orderBy(desc(posts.publishedAt))
    .limit(limit);
  return Promise.all(
    rows.map(async (p) => ({
      ...p,
      bodyHtml: (await storedBody(env, p)).html,
    })),
  );
}

export const listEpisodes = (env: Env, limit?: number) =>
  listPosts(env, { kind: "episode", limit });

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

/** What a loader throws for a slug with no visible post: a 301 for a renamed slug (post_redirects), else a 404. A non-visible post gets the 404, so a redirect never names a draft. */
export async function missingPost(env: Env, slug: string, suffix = ""): Promise<Response> {
  const [row] = await getDb(env)
    .select({ slug: posts.slug })
    .from(postRedirects)
    .innerJoin(posts, eq(posts.id, postRedirects.postId))
    .where(and(eq(postRedirects.fromSlug, slug), publiclyVisible()))
    .limit(1);
  return row
    ? new Response(null, {
        status: 301,
        headers: { Location: `/${row.slug}${suffix}` },
      })
    : new Response("Not found", { status: 404 });
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
  return all.filter((p) => (p.guests ?? []).some((g) => slugify(g.name) === guestSlug));
}

export function adjacentPosts(
  visible: Post[],
  post: Post,
): { prev: Post | null; next: Post | null } {
  const all = visible.filter((p) => p.kind === post.kind); // newest-first, visible only
  const i = all.findIndex((p) => p.id === post.id);
  if (i === -1) return { prev: null, next: null };
  return { prev: all[i + 1] ?? null, next: all[i - 1] ?? null }; // older = prev, newer = next
}

/** "Part n of m": m is the series' live posts with this one, or the highest part named, whichever is more. */
export function seriesOf(
  visible: Post[],
  post: Post,
): { name: string; part: number; of: number } | null {
  if (!post.series || !post.seriesPart) return null;
  const others = visible.filter((p) => p.series === post.series && p.id !== post.id);
  const of = Math.max(others.length + 1, post.seriesPart, ...others.map((p) => p.seriesPart ?? 0));
  return { name: post.series, part: post.seriesPart, of };
}

export function relatedPosts(visible: Post[], post: Post, limit = 3): Post[] {
  const tags = new Set(post.tags ?? []);
  return visible
    .filter((p) => p.kind === post.kind && p.id !== post.id)
    .map((p) => ({
      p,
      score: (p.tags ?? []).filter((t) => tags.has(t)).length,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
}

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
  return asCards(found.sort((a, b) => order.get(a.id)! - order.get(b.id)!));
}

// FTS5 has its own query syntax. Anything but a letter, digit or combining mark separates words, then every word is a
// quoted literal (Prelum's toMatchExpression), all ANDed, the last one also matching as a prefix. A mark stays with its
// letter, so "İstanbul" (lowercased to i and a dot) is one word, as the tokenizer reads it. Site search over pages
// (content.server) builds its MATCH here too. Not Prelum's searchWords: its NFKD fold splits Hangul into jamo and folds
// ễ, ﬁ and ² where the posts_fts tokenizer (unicode61, remove_diacritics 1) does not, so those queries would find
// nothing; unicode61 folds é and å itself.
export function toFtsMatch(raw: string): string | null {
  const terms = raw
    .toLowerCase()
    .split(/[^\p{L}\p{N}\p{M}]+/u)
    .filter(Boolean);
  return toMatchExpression({ terms }, true);
}
