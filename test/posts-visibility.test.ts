import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  adjacentPosts,
  episodesInSeason,
  getPostBySlug,
  isVisibleNow,
  listArticles,
  listEpisodes,
  listPosts,
  listSeasons,
  postsByGuest,
  postsByTag,
  relatedPosts,
  searchPosts,
} from "~/lib/posts.server";
import type { Post } from "~/db/schema";
import { applyMigrations } from "./helpers/d1";

// Every public read goes through posts.server, and the publish-on-read gate there is what keeps a
// draft or a post scheduled into the future off lists, pages, search and feeds. Listing reads also
// leave out the heavy fields.
const e = env as unknown as Env;
const PAST = "2020-01-01T00:00:00.000Z";
const FUTURE = () => new Date(Date.now() + 86_400_000).toISOString();

type Row = { kind?: string; slug: string; title?: string; status?: string; publishAt?: string | null; publishedAt?: string | null; tags?: string[]; guests?: { name: string }[]; season?: number | null; episode?: number | null; body?: string };
async function add(r: Row): Promise<number> {
  const res = await e.DB.prepare(
    "INSERT INTO posts (kind, slug, title, status, publish_at, published_at, tags, guests, season_number, episode_number, body, transcript, audio_peaks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'WEBVTT', '[1,2]') RETURNING id",
  )
    .bind(r.kind ?? "article", r.slug, r.title ?? r.slug, r.status ?? "published", r.publishAt ?? null, r.publishedAt ?? PAST, JSON.stringify(r.tags ?? []), JSON.stringify(r.guests ?? []), r.season ?? null, r.episode ?? null, r.body ?? `<p>${r.slug}</p>`)
    .first<{ id: number }>();
  return res!.id;
}
const slugs = (ps: Post[]) => ps.map((p) => p.slug);

beforeAll(() => applyMigrations(e.DB));
beforeEach(async () => {
  for (const t of ["episode_people", "soundbites", "post_versions", "posts"]) await e.DB.exec(`DELETE FROM ${t}`);
});

describe("the publish-on-read gate", () => {
  beforeEach(async () => {
    await add({ slug: "live", publishedAt: "2024-01-01T00:00:00.000Z" });
    await add({ slug: "was-scheduled", publishAt: PAST, publishedAt: "2023-01-01T00:00:00.000Z" });
    await add({ slug: "draft", status: "draft" });
    await add({ slug: "later", publishAt: FUTURE() });
  });

  it("lists only published posts whose time has come, newest first", async () => {
    expect(slugs(await listPosts(e))).toEqual(["live", "was-scheduled"]);
  });

  it("hides a draft and a future post from the page unless drafts are asked for", async () => {
    expect((await getPostBySlug(e, "live"))?.slug).toBe("live");
    expect((await getPostBySlug(e, "was-scheduled"))?.slug).toBe("was-scheduled");
    expect(await getPostBySlug(e, "draft")).toBeNull();
    expect(await getPostBySlug(e, "later")).toBeNull();
    expect(await getPostBySlug(e, "nope")).toBeNull();
    expect((await getPostBySlug(e, "draft", { includeDrafts: true }))?.slug).toBe("draft");
    expect((await getPostBySlug(e, "later", { includeDrafts: true }))?.slug).toBe("later");
  });

  it("keeps hidden posts out of search, matching every word and a prefix of the last", async () => {
    expect(slugs(await searchPosts(e, "liv"))).toEqual(["live"]);
    expect(await searchPosts(e, "draft")).toEqual([]);
    expect(await searchPosts(e, "later")).toEqual([]);
    expect(await searchPosts(e, "  ?! ")).toEqual([]);
    expect(await searchPosts(e, "nothing-like-it")).toEqual([]);
  });

  it("agrees with the in-JS check on single rows", async () => {
    const base = { status: "published", publishAt: null } as unknown as Post;
    expect(isVisibleNow(base)).toBe(true);
    expect(isVisibleNow({ ...base, publishAt: PAST })).toBe(true);
    expect(isVisibleNow({ ...base, publishAt: FUTURE() })).toBe(false);
    expect(isVisibleNow({ ...base, status: "draft" })).toBe(false);
    const now = new Date().toISOString();
    expect(isVisibleNow({ ...base, publishAt: now })).toBe(true);
  });
});

describe("listing reads", () => {
  it("filters by kind, honors the limit, and leaves out the heavy fields", async () => {
    await add({ slug: "ep", kind: "episode", publishedAt: "2024-02-01T00:00:00.000Z" });
    await add({ slug: "a1", publishedAt: "2024-03-01T00:00:00.000Z" });
    await add({ slug: "a2", publishedAt: "2024-01-01T00:00:00.000Z" });
    expect(slugs(await listEpisodes(e))).toEqual(["ep"]);
    expect(slugs(await listArticles(e))).toEqual(["a1", "a2"]);
    expect(slugs(await listArticles(e, 1))).toEqual(["a1"]);
    const [card] = await listEpisodes(e);
    expect(card).toMatchObject({ body: "", transcript: null, audioPeaks: null, sources: null, keyMoments: null });
    const full = (await getPostBySlug(e, "ep"))!;
    expect(full.transcript).toBe("WEBVTT");
    expect(full.audioPeaks).toEqual([1, 2]);
  });

  it("lists visible seasons newest first, and a season's episodes from number one", async () => {
    await add({ slug: "s1e2", kind: "episode", season: 1, episode: 2 });
    await add({ slug: "s1e1", kind: "episode", season: 1, episode: 1 });
    await add({ slug: "s2e1", kind: "episode", season: 2, episode: 1 });
    await add({ slug: "s3-draft", kind: "episode", season: 3, episode: 1, status: "draft" });
    await add({ slug: "no-season", kind: "episode" });
    await add({ slug: "art", kind: "article", season: 9 });
    expect(await listSeasons(e)).toEqual([2, 1]);
    expect(slugs(await episodesInSeason(e, 1))).toEqual(["s1e1", "s1e2"]);
    expect(await episodesInSeason(e, 3)).toEqual([]);
  });

  it("finds visible posts by tag and episodes by guest", async () => {
    await add({ slug: "t1", tags: ["cholera", "x"] });
    await add({ slug: "t2", tags: ["plague"] });
    await add({ slug: "t3", tags: ["cholera"], status: "draft" });
    await add({ slug: "g1", kind: "episode", guests: [{ name: "Ada Lovelace" }] });
    await add({ slug: "g2", kind: "article", guests: [{ name: "Ada Lovelace" }] });
    expect(slugs(await postsByTag(e, "cholera"))).toEqual(["t1"]);
    expect(slugs(await postsByGuest(e, "ada-lovelace"))).toEqual(["g1"]);
    expect(await postsByGuest(e, "nobody")).toEqual([]);
  });
});

describe("navigation between posts", () => {
  it("gives the older post as previous and the newer as next, within the same kind", async () => {
    await add({ slug: "old", publishedAt: "2024-01-01T00:00:00.000Z" });
    const mid = await add({ slug: "mid", publishedAt: "2024-02-01T00:00:00.000Z" });
    await add({ slug: "new", publishedAt: "2024-03-01T00:00:00.000Z" });
    await add({ slug: "ep", kind: "episode", publishedAt: "2024-02-15T00:00:00.000Z" });
    const midPost = (await getPostBySlug(e, "mid"))!;
    expect(midPost.id).toBe(mid);
    const { prev, next } = adjacentPosts(await listPosts(e), midPost);
    expect([prev?.slug, next?.slug]).toEqual(["old", "new"]);
    const ends = adjacentPosts(await listPosts(e), (await getPostBySlug(e, "new"))!);
    expect([ends.prev?.slug, ends.next]).toEqual(["mid", null]);
    const hidden = (await getPostBySlug(e, "nope", { includeDrafts: true })) ?? ({ id: -1, kind: "article" } as Post);
    expect(adjacentPosts(await listPosts(e), hidden)).toEqual({ prev: null, next: null });
  });

  it("ranks related posts by shared tags, never the post itself, up to the limit", async () => {
    await add({ slug: "me", tags: ["a", "b", "c"], publishedAt: "2024-05-01T00:00:00.000Z" });
    await add({ slug: "two", tags: ["a", "b"], publishedAt: "2024-01-01T00:00:00.000Z" });
    await add({ slug: "one", tags: ["c"], publishedAt: "2024-04-01T00:00:00.000Z" });
    await add({ slug: "none", tags: [], publishedAt: "2024-03-01T00:00:00.000Z" });
    await add({ slug: "three", tags: ["a", "b", "c"], publishedAt: "2024-02-01T00:00:00.000Z" });
    const me = (await getPostBySlug(e, "me"))!;
    expect(slugs(relatedPosts(await listPosts(e), me))).toEqual(["three", "two", "one"]);
    expect(slugs(relatedPosts(await listPosts(e), me, 1))).toEqual(["three"]);
  });
});
