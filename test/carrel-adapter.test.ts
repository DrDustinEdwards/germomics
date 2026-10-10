import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MediaInUseError, NotFoundError, RefusedError, VersionConflictError } from "@dustinedwards/site-api";
import { createCarrelAdapter } from "~/lib/carrel/adapter.server";
import { carrelApi } from "~/lib/carrel/handler.server";
import { applyMigrations } from "./helpers/d1";

// The adapter as site-api calls it: what Carrel reads back (summaries, versions, revisions), what it
// stores (fields, status, guid, snapshots), what it refuses, and the change log. carrel.test.ts covers
// the HTTP guard and the round trip; this file covers the adapter's own rules.
const e = env as unknown as Env;
let logged: Record<string, unknown>[] = [];
// Built per test, not at import, so a mutation run sees each test exercise the adapter it builds.
let adapter: ReturnType<typeof createCarrelAdapter>;
let content: typeof adapter.content;
let media: NonNullable<typeof adapter.media>;

const save = (id: string, source: string, expectedVersion: string | null = null, changeId = "chg_s") =>
  content.saveDraft(id, { source, expectedVersion, changeId });
const row = (slug: string) => e.DB.prepare("SELECT * FROM posts WHERE slug = ?").bind(slug).first<Record<string, any>>();
const insert = (sql: string, ...binds: unknown[]) => e.DB.prepare(sql).bind(...binds).run();

beforeAll(() => applyMigrations(e.DB));

beforeEach(async () => {
  logged = [];
  adapter = createCarrelAdapter(e, (entry) => logged.push(entry));
  content = adapter.content;
  media = adapter.media!;
  await e.DB.exec("DELETE FROM post_versions");
  await e.DB.exec("DELETE FROM posts");
  const listed = await e.BLOG_IMAGES.list();
  if (listed.objects.length) await e.BLOG_IMAGES.delete(listed.objects.map((o) => o.key));
});

describe("saving a draft", () => {
  it("creates a draft from the source and logs the change with its id", async () => {
    const res = await save("first", '---\ntitle: "  First  "\nexcerpt: "E"\ntags: ["a"]\n---\n<p>one two three</p>', null, "chg_1");
    expect(res).toMatchObject({ id: "first", status: "draft", changeId: "chg_1" });
    expect(res.version).toMatch(/^[0-9a-f]{32}$/);
    const r = (await row("first"))!;
    expect(r).toMatchObject({ kind: "article", title: "First", excerpt: "E", status: "draft", reading_time: 1 });
    expect(JSON.parse(r.tags)).toEqual(["a"]);
    expect(logged).toEqual([{ event: "carrel.save", id: "first", version: res.version, changeId: "chg_1" }]);
  });

  it("names a blank title Untitled", async () => {
    await save("blank", '---\ntitle: "   "\n---\n<p>x</p>');
    expect((await row("blank"))!.title).toBe("Untitled");
    await save("none", "<p>x</p>");
    expect((await row("none"))!.title).toBe("Untitled");
  });

  it("leaves fields the source does not name alone, and snapshots the row before the edit", async () => {
    const created = await save("keep", '---\ntitle: "T"\nexcerpt: "Keep me"\ncoverImage: "https://images.germomics.com/c.png"\ncoverAlt: "C"\nseoTitle: "S"\nseoDescription: "D"\n---\n<p>v1</p>');
    const edited = await save("keep", "<p>v2</p>", created.version);
    expect(edited.version).not.toBe(created.version);
    const r = (await row("keep"))!;
    expect(r).toMatchObject({ title: "T", excerpt: "Keep me", cover_image: "https://images.germomics.com/c.png", cover_alt: "C", seo_title: "S", seo_description: "D", body: "<p>v2</p>" });
    const snaps = await e.DB.prepare("SELECT snapshot FROM post_versions").all<{ snapshot: string }>();
    expect(snaps.results).toHaveLength(1);
    expect(JSON.parse(snaps.results[0].snapshot).body).toBe("<p>v1</p>");
  });

  it("replaces each named field with the new value", async () => {
    const created = await save("swap", '---\nexcerpt: "old"\ncoverAlt: "old"\nseoTitle: "old"\nseoDescription: "old"\ncoverImage: "old"\n---\n<p>x</p>');
    await save("swap", '---\nexcerpt: "new"\ncoverAlt: "new"\nseoTitle: "new"\nseoDescription: "new"\ncoverImage: "new"\n---\n<p>x</p>', created.version);
    expect(await row("swap")).toMatchObject({ excerpt: "new", cover_alt: "new", seo_title: "new", seo_description: "new", cover_image: "new" });
  });

  it("refuses a source it cannot read, with the parser's reason", async () => {
    await expect(save("bad", "---\ntitle: nope\n---\n")).rejects.toThrow(RefusedError);
    await expect(save("bad", "---\ntitle: nope\n---\n")).rejects.toThrow('Front matter "title" is not valid JSON.');
    expect(await row("bad")).toBeNull();
  });

  it("refuses an id that cannot be a slug, and a slug an episode holds", async () => {
    await expect(save("-leading-dash", "<p>x</p>")).rejects.toThrow("That id cannot be used as a slug.");
    await insert("INSERT INTO posts (kind, title, slug, body, status) VALUES ('episode', 'Ep', 'ep-1', '', 'draft')");
    await expect(save("ep-1", "<p>x</p>")).rejects.toThrow("That slug belongs to a podcast episode, which Carrel does not edit.");
  });

  it("refuses a version that is not current, naming the current one", async () => {
    const created = await save("v", "<p>x</p>");
    const err = await save("v", "<p>y</p>", "f".repeat(32)).catch((x) => x);
    expect(err).toBeInstanceOf(VersionConflictError);
    expect(err.currentVersion).toBe(created.version);
  });
});

describe("publishing, scheduling and unpublishing", () => {
  it("refuses each of them for an article that does not exist", async () => {
    await expect(content.publish("ghost", { expectedVersion: null, changeId: "c" })).rejects.toThrow(NotFoundError);
    await expect(content.schedule("ghost", { expectedVersion: null, changeId: "c", publishAt: new Date().toISOString() })).rejects.toThrow(NotFoundError);
    await expect(content.unpublish("ghost", { expectedVersion: null, changeId: "c" })).rejects.toThrow(NotFoundError);
    expect(await row("ghost")).toBeNull();
  });

  it("publishes once, keeping the first publish date and guid, and applies a source sent with it", async () => {
    const v1 = await save("pub", "<p>x</p>");
    const p1 = await content.publish("pub", { expectedVersion: v1.version, changeId: "c1", source: '---\ntitle: "Now titled"\n---\n<p>y</p>' });
    expect(p1.status).toBe("published");
    expect(logged.at(-1)).toMatchObject({ event: "carrel.publish", id: "pub", changeId: "c1" });
    const first = (await row("pub"))!;
    expect(first).toMatchObject({ title: "Now titled", body: "<p>y</p>", publish_at: null });
    expect(first.published_at).toBeTruthy();
    const u = await content.unpublish("pub", { expectedVersion: p1.version, changeId: "c2" });
    expect(u.status).toBe("draft");
    expect(logged.at(-1)).toMatchObject({ event: "carrel.unpublish" });
    await content.publish("pub", { expectedVersion: u.version, changeId: "c3" });
    const again = (await row("pub"))!;
    expect(again.published_at).toBe(first.published_at);
    expect(again.guid).toBe(first.guid);
  });

  it("schedules with the given time, keeps an existing guid, and reports past times as published", async () => {
    await save("sch", "<p>x</p>");
    await insert("UPDATE posts SET guid = 'urn:germomics:kept' WHERE slug = 'sch'");
    const current = (await content.get("sch"))!;
    const past = "2020-01-02T03:04:05.000Z";
    const s = await content.schedule("sch", { expectedVersion: current.version, changeId: "c", source: '---\ntitle: "Sched"\n---\n<p>z</p>', publishAt: past });
    expect(s.status).toBe("published");
    expect(logged.at(-1)).toMatchObject({ event: "carrel.schedule" });
    expect(await row("sch")).toMatchObject({ guid: "urn:germomics:kept", publish_at: past, published_at: past, title: "Sched", status: "published" });
    const doc = (await content.get("sch"))!;
    expect(doc).toMatchObject({ status: "published", publishAt: past, publishedAt: past, path: "/sch" });
  });
});

describe("reading", () => {
  it("summarises a row: ISO times from SQLite's format, a path only once published", async () => {
    await insert("INSERT INTO posts (kind, title, slug, body, status, updated_at) VALUES ('article', 'Draft', 'd', '', 'draft', '2026-01-02 03:04:05')");
    const doc = (await content.get("d"))!;
    expect(doc).toMatchObject({ id: "d", kind: "article", title: "Draft", status: "draft", path: null, publishAt: null, publishedAt: null, updatedAt: "2026-01-02T03:04:05.000Z", format: "markdown" });
    expect(doc.source).toBe('---\ntitle: "Draft"\n---\n');
    await insert("UPDATE posts SET updated_at = 'not a date' WHERE slug = 'd'");
    expect((await content.get("d"))!.updatedAt).toBeNull();
    expect(await content.get("missing")).toBeNull();
  });

  it("calls a published row with a future publish time scheduled", async () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    await insert("INSERT INTO posts (kind, title, slug, body, status, publish_at) VALUES ('article', 'F', 'f', '', 'published', ?)", future);
    expect((await content.get("f"))!.status).toBe("scheduled");
  });

  it("gives a new version when only the status or schedule changes", async () => {
    await insert("INSERT INTO posts (kind, title, slug, body, status) VALUES ('article', 'S', 's', '', 'draft')");
    const draft = (await content.get("s"))!.version;
    await insert("UPDATE posts SET status = 'published' WHERE slug = 's'");
    const published = (await content.get("s"))!.version;
    await insert("UPDATE posts SET publish_at = '2020-01-01T00:00:00.000Z' WHERE slug = 's'");
    const scheduled = (await content.get("s"))!.version;
    expect(new Set([draft, published, scheduled]).size).toBe(3);
  });

  it("lists articles only, filtered by text and status, newest first, a page at a time", async () => {
    for (const [slug, title, updated] of [["alpha", "Cholera notes", "2026-01-01 00:00:00"], ["beta", "Plague", "2026-01-03 00:00:00"], ["gamma-cholera", "Third", "2026-01-02 00:00:00"]]) {
      await insert("INSERT INTO posts (kind, title, slug, body, status, updated_at) VALUES ('article', ?, ?, '', 'draft', ?)", title, slug, updated);
    }
    await insert("INSERT INTO posts (kind, title, slug, body, status) VALUES ('article', 'Bad slug', '-bad', '', 'draft')");
    await insert("INSERT INTO posts (kind, title, slug, body, status) VALUES ('episode', 'Cholera episode', 'ep', '', 'draft')");
    await insert("UPDATE posts SET status = 'published' WHERE slug = 'beta'");

    const ids = async (q: Parameters<typeof content.list>[0]) => (await content.list(q)).items.map((i) => i.id);
    expect(await ids({ limit: 10 })).toEqual(["beta", "gamma-cholera", "alpha"]);
    expect(await ids({ limit: 10, q: "cholera" })).toEqual(["gamma-cholera", "alpha"]);
    expect(await ids({ limit: 10, status: "published" })).toEqual(["beta"]);

    const first = await content.list({ limit: 2 });
    expect(first.items.map((i) => i.id)).toEqual(["beta", "gamma-cholera"]);
    expect(first.nextCursor).toBe("2");
    const second = await content.list({ limit: 2, cursor: first.nextCursor! });
    expect(second.items.map((i) => i.id)).toEqual(["alpha"]);
    expect(second.nextCursor).toBeNull();
    expect((await content.list({ limit: 3 })).nextCursor).toBeNull();
    expect(await ids({ limit: 1, cursor: "-5" })).toEqual(["beta"]);
    expect(await ids({ limit: 1, cursor: "junk" })).toEqual(["beta"]);
  });

  it("lists revisions, newest first, and returns the source of any of them", async () => {
    expect(await content.revisions("nope")).toBeNull();
    expect(await content.revisionSource("nope", "a".repeat(32))).toBeNull();
    const v1 = await save("rev", '---\ntitle: "One"\n---\n<p>1</p>');
    const v2 = await save("rev", '---\ntitle: "Two"\n---\n<p>2</p>', v1.version);
    await save("rev", '---\ntitle: "Three"\n---\n<p>3</p>', v2.version);
    const items = (await content.revisions("rev"))!;
    expect(items.map((i) => i.version)).toEqual([v2.version, v1.version]);
    expect(items[0]).toMatchObject({ author: "germomics", message: "Saved before an edit (Two)" });
    expect(items[0].at).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.000Z$/);
    expect(await content.revisionSource("rev", v1.version)).toBe('---\ntitle: "One"\n---\n<p>1</p>');
    const current = (await content.get("rev"))!;
    expect(await content.revisionSource("rev", current.version)).toBe(current.source);
    expect(await content.revisionSource("rev", "0".repeat(32))).toBeNull();
  });
});

describe("preview", () => {
  it("escapes the title and falls back to Untitled", async () => {
    const html = await adapter.preview!.render({ source: '---\ntitle: "<b>&\\"x\\""\n---\n<p>b</p>' });
    expect(html).toContain("<title>&#60;b&#62;&#38;&#34;x&#34;</title>");
    expect(html).toContain("<h1>&#60;b&#62;&#38;&#34;x&#34;</h1>");
    expect(html).toContain('<meta name="robots" content="noindex">');
    expect(await adapter.preview!.render({ source: "<p>b</p>" })).toContain("<h1>Untitled</h1>");
  });
});

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe("media", () => {
  it("stores an upload with its alt, filename and change id, and logs it", async () => {
    const item = await media.upload({ bytes: PNG, contentType: "image/png", filename: "Pic One.png", alt: "A pixel", changeId: "chg_u" });
    expect(item).toMatchObject({ contentType: "image/png", alt: "A pixel", filename: "Pic One.png", bytes: PNG.length, deletable: true, width: null });
    expect(item.id.startsWith("carrel/")).toBe(true);
    expect(item.uploadedAt).toMatch(/Z$/);
    const head = (await e.BLOG_IMAGES.head(item.id))!;
    expect(head.httpMetadata?.contentType).toBe("image/png");
    expect(head.customMetadata).toEqual({ alt: "A pixel", filename: "Pic One.png", changeId: "chg_u" });
    expect(logged).toEqual([{ event: "carrel.media.upload", id: item.id, version: head.etag, changeId: "chg_u" }]);
  });

  it("describes a file with no metadata from its key", async () => {
    await e.BLOG_IMAGES.put("posts/1/raw.jpg", PNG);
    const got = (await media.get("posts/1/raw.jpg"))!;
    expect(got).toMatchObject({ id: "posts/1/raw.jpg", filename: "raw.jpg", alt: "", contentType: "application/octet-stream", usedBy: [] });
    expect(await media.get("posts/1/none.jpg")).toBeNull();
  });

  it("lists files matching the text without regard to case, a page at a time", async () => {
    for (const k of ["a/Cholera.png", "a/plague.png", "a/cholera-2.png"]) await e.BLOG_IMAGES.put(k, PNG, { httpMetadata: { contentType: "image/png" } });
    const hits = await media.list({ q: "CHOLERA", limit: 10 });
    expect(hits.items.map((i) => i.id).sort()).toEqual(["a/Cholera.png", "a/cholera-2.png"]);
    expect(hits.nextCursor).toBeNull();
    expect((await media.list({ limit: 2 })).items).toHaveLength(2);
  });

  it("names every place a post uses a file, and skips a LIKE wildcard match", async () => {
    const key = "carrel/a_b.png";
    await e.BLOG_IMAGES.put(key, PNG);
    const url = `https://images.germomics.com/${key}`;
    await insert("INSERT INTO posts (kind, title, slug, body, status, cover_image, og_image, episode_artwork) VALUES ('episode', 'All of them', 'all', ?, 'draft', ?, ?, ?)", `<img src="${url}">`, url, url, url);
    await insert("INSERT INTO posts (kind, title, slug, body, status) VALUES ('article', 'Lookalike', 'lookalike', '<img src=\"carrel/aXb.png\">', 'draft')");
    const got = (await media.get(key))!;
    expect(got.usedBy).toEqual([{ type: "post", id: "all", title: "All of them", detail: "cover image, social image, episode artwork, body" }]);
    await expect(media.delete(key, { changeId: "c" })).rejects.toThrow(MediaInUseError);
    expect(await e.BLOG_IMAGES.head(key)).not.toBeNull();
  });

  it("deletes an unused file and logs it, and refuses a file that is not there", async () => {
    await e.BLOG_IMAGES.put("carrel/x.png", PNG);
    await insert("INSERT INTO posts (kind, title, slug, body, status) VALUES ('article', 'Lookalike', 'l', '<img src=\"carrel/xypng\">', 'draft')");
    await media.delete("carrel/x.png", { changeId: "chg_d" });
    expect(await e.BLOG_IMAGES.head("carrel/x.png")).toBeNull();
    expect(logged).toEqual([{ event: "carrel.media.delete", id: "carrel/x.png", version: "deleted", changeId: "chg_d" }]);
    await expect(media.delete("carrel/x.png", { changeId: "c" })).rejects.toThrow(NotFoundError);
  });
});

describe("the mounted handler", () => {
  const limiter = { limit: async () => ({ success: true }) };
  const meta = new Request("https://germomics.com/api/carrel/v1/meta", { headers: { Authorization: `Bearer ${"k".repeat(40)}` } });

  it("answers with the configured key and refuses everything when no key is set", async () => {
    const withKey = carrelApi({ ...e, CARREL_SITE_KEY: "k".repeat(40), CARREL_RATE_LIMIT: limiter } as unknown as Env);
    expect(withKey.matches(meta)).toBe(true);
    expect((await withKey.handle(meta.clone())).status).toBe(200);
    const noKey = carrelApi({ ...e, CARREL_SITE_KEY: undefined, CARREL_RATE_LIMIT: limiter } as unknown as Env);
    expect((await noKey.handle(meta.clone())).status).toBe(503);
  });
});
