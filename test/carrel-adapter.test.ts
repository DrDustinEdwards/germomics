import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RefusedError, VersionConflictError } from "@dustinedwards/site-api";
import { createCarrelAdapter } from "~/lib/carrel/adapter.server";
import { RENDER_VERSION } from "~/lib/render.server";
import { carrelApi } from "~/lib/carrel/handler.server";
import { applyMigrations } from "./helpers/d1";

// The adapter as site-api calls it: what Carrel reads back (summaries, versions, revisions), what it
// stores (fields, status, guid, snapshots), what it refuses, and the change log. carrel.test.ts covers
// the HTTP guard and the round trip, carrel-media.test.ts the media group; this file covers the adapter's own rules.
const e = env as unknown as Env;
let logged: Record<string, unknown>[] = [];
// Built per test, not at import, so a mutation run sees each test exercise the adapter it builds.
let adapter: ReturnType<typeof createCarrelAdapter>;
let content: typeof adapter.content;

const save = (id: string, source: string, expectedVersion: string | null = null, changeId = "chg_s") =>
  content.saveDraft(id, { source, expectedVersion, changeId });
const row = (slug: string) => e.DB.prepare("SELECT * FROM posts WHERE slug = ?").bind(slug).first<Record<string, any>>();
const insert = (sql: string, ...binds: unknown[]) => e.DB.prepare(sql).bind(...binds).run();

beforeAll(() => applyMigrations(e.DB));

beforeEach(async () => {
  logged = [];
  adapter = createCarrelAdapter(e, (entry) => logged.push(entry));
  content = adapter.content;
  await e.DB.exec("DELETE FROM post_versions");
  await e.DB.exec("DELETE FROM posts");
  await e.DB.exec("DELETE FROM scheduled_updates");
  await e.DB.exec("DELETE FROM content_blocks");
  await e.DB.exec("DELETE FROM episode_people");
  await e.DB.exec("DELETE FROM people");
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
    const created = await save("keep", '---\ntitle: "T"\nexcerpt: "Keep me"\ncoverImage: "/media/c.png"\ncoverAlt: "C"\nseoTitle: "S"\nseoDescription: "D"\n---\n<p>v1</p>');
    const edited = await save("keep", "<p>v2</p>", created.version);
    expect(edited.version).not.toBe(created.version);
    const r = (await row("keep"))!;
    expect(r).toMatchObject({ title: "T", excerpt: "Keep me", cover_image: "/media/c.png", cover_alt: "C", seo_title: "S", seo_description: "D", body: "<p>v2</p>" });
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
    await expect(save("bad", '---\ntags: "one"\n---\n')).rejects.toThrow(RefusedError);
    await expect(save("bad", '---\ntags: "one"\n---\n')).rejects.toThrow("tags must be a list of strings");
    expect(await row("bad")).toBeNull();
  });

  it("refuses an id that cannot be a slug, and an id in the pages' form", async () => {
    await expect(save("-leading-dash", "x")).rejects.toThrow("That id cannot be used as a slug.");
    await expect(save("page.new", "x")).rejects.toThrow(RefusedError);
    expect(await row("page.new")).toBeNull();
  });

  it("stores the Markdown with its render, reading time and render version, and refuses one Prelum refuses", async () => {
    await save("md", '---\ntitle: "M"\n---\n## Part\n\nSome *words*.\n');
    expect(await row("md")).toMatchObject({ body: "## Part\n\nSome *words*.\n", render_version: RENDER_VERSION, reading_time: 1 });
    expect((await row("md"))!.body_html).toContain("<em>words</em>");
    await expect(save("md2", ':::figure{src="/media/x.webp"}\nx\n:::')).rejects.toThrow("requires an alt attribute");
    expect(await row("md2")).toBeNull();
  });

  it("refuses a version that is not current, naming the current one", async () => {
    const created = await save("v", "<p>x</p>");
    const err = await save("v", "<p>y</p>", "f".repeat(32)).catch((x) => x);
    expect(err).toBeInstanceOf(VersionConflictError);
    expect(err.currentVersion).toBe(created.version);
  });
});

describe("publishing, scheduling and unpublishing", () => {
  it("refuses each of them for an article that does not exist, naming no current version", async () => {
    const v = "a".repeat(32);
    for (const attempt of [
      content.publish("ghost", { expectedVersion: v, changeId: "c" }),
      content.schedule("ghost", { expectedVersion: v, changeId: "c", publishAt: new Date().toISOString() }),
      content.unpublish("ghost", { expectedVersion: v, changeId: "c" }),
    ]) {
      const err = await attempt.catch((x) => x);
      expect(err).toBeInstanceOf(VersionConflictError);
      expect(err.currentVersion).toBeNull();
    }
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

describe("an update scheduled on a live article", () => {
  const live = async (slug: string) => {
    const d = await save(slug, '---\ntitle: "Live"\n---\n<p>old</p>');
    return content.publish(slug, { expectedVersion: d.version, changeId: "c_pub" });
  };
  const at = "2030-01-01T15:00:00.000Z";

  it("waits while the live version is served, then the cron pass puts it live once", async () => {
    const pub = await live("upd");
    const schedules = adapter.schedules!;
    const s = await schedules.update("upd", { source: '---\ntitle: "New"\n---\n<p>new</p>', publishAt: at, expectedVersion: pub.version, changeId: "c_upd" });
    expect(s).toMatchObject({ status: "published", scheduledUpdate: { publishAt: at, changeId: "c_upd" } });
    expect(s.version).not.toBe(pub.version);
    const doc = (await content.get("upd"))!;
    expect(doc).toMatchObject({ version: s.version, scheduledUpdate: { publishAt: at, changeId: "c_upd" } });
    expect((await row("upd"))!.body).toBe("<p>old</p>");

    expect(await schedules.due({ now: new Date("2029-12-31T00:00:00Z"), limit: 50 })).toEqual([]);
    const now = new Date("2030-01-01T15:00:30Z");
    const [due] = await schedules.due({ now, limit: 50 });
    expect(due).toMatchObject({ id: "upd", kind: "update", publishAt: at, changeId: "c_upd" });
    expect(await schedules.apply("upd", { ...due!, now })).toMatchObject({ status: "published", scheduledUpdate: null });
    expect((await row("upd"))!).toMatchObject({ title: "New", body: "<p>new</p>", status: "published" });
    // Applied, so gone: a second pass changes nothing.
    expect(await schedules.apply("upd", { ...due!, now })).toBeNull();
    expect(await schedules.due({ now, limit: 50 })).toEqual([]);
  });

  it("is dropped by a publish now and by a cancel, and the cancel keeps the article live", async () => {
    const schedules = adapter.schedules!;
    const pub = await live("drop");
    const s = await schedules.update("drop", { source: "<p>later</p>", publishAt: at, expectedVersion: pub.version, changeId: "c1" });
    const now = await content.publish("drop", { expectedVersion: s.version, changeId: "c2" });
    expect(now.scheduledUpdate).toBeNull();
    expect(await schedules.get("drop")).toBeNull();

    const again = await schedules.update("drop", { source: "<p>later</p>", publishAt: at, expectedVersion: now.version, changeId: "c3" });
    const canceled = await schedules.cancel("drop", { expectedVersion: again.version, changeId: "c4" });
    expect(canceled).toMatchObject({ status: "published", scheduledUpdate: null, version: now.version });
    expect(await schedules.get("drop")).toBeNull();
    await expect(schedules.cancel("drop", { expectedVersion: now.version, changeId: "c5" })).rejects.toBeInstanceOf(RefusedError);
  });
});

describe("reading", () => {
  it("summarizes a row: ISO times from SQLite's format, a path only once published", async () => {
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

  it("lists articles and episodes, filtered by text and status, newest first, a page at a time", async () => {
    for (const [slug, title, updated] of [["alpha", "Cholera notes", "2026-01-01 00:00:00"], ["beta", "Plague", "2026-01-03 00:00:00"], ["gamma-cholera", "Third", "2026-01-02 00:00:00"]]) {
      await insert("INSERT INTO posts (kind, title, slug, body, status, updated_at) VALUES ('article', ?, ?, '', 'draft', ?)", title, slug, updated);
    }
    await insert("INSERT INTO posts (kind, title, slug, body, status) VALUES ('article', 'Bad slug', '-bad', '', 'draft')");
    await insert("INSERT INTO posts (kind, title, slug, body, status, updated_at) VALUES ('episode', 'Cholera episode', 'ep', '', 'draft', '2025-12-01 00:00:00')");
    await insert("UPDATE posts SET status = 'published' WHERE slug = 'beta'");

    const ids = async (q: Parameters<typeof content.list>[0]) => (await content.list(q)).items.map((i) => i.id);
    expect(await ids({ limit: 10 })).toEqual(["beta", "gamma-cholera", "alpha", "ep"]);
    expect(await ids({ limit: 10, q: "cholera" })).toEqual(["gamma-cholera", "alpha", "ep"]);
    expect(await ids({ limit: 10, status: "published" })).toEqual(["beta"]);

    const first = await content.list({ limit: 2 });
    expect(first.items.map((i) => i.id)).toEqual(["beta", "gamma-cholera"]);
    expect(first.nextCursor).toBe("2");
    const second = await content.list({ limit: 2, cursor: first.nextCursor! });
    expect(second.items.map((i) => i.id)).toEqual(["alpha", "ep"]);
    expect(second.nextCursor).toBeNull();
    expect((await content.list({ limit: 4 })).nextCursor).toBeNull();
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

describe("an episode", () => {
  const episode = (status: string) =>
    insert("INSERT INTO posts (kind, title, slug, body, status, guid, audio_url) VALUES ('episode', 'Ep', 'ep', 'Old', ?, 'urn:germomics:ep', 'https://media.germomics.com/ep.mp3')", status);

  it("takes its text from Carrel, live, and keeps its audio and guid", async () => {
    await episode("published");
    const doc = (await content.get("ep"))!;
    expect(doc).toMatchObject({ kind: "episode", status: "published" });
    await save("ep", '---\ntitle: "Ep, retitled"\n---\nNew notes', doc.version);
    expect(await row("ep")).toMatchObject({ kind: "episode", title: "Ep, retitled", body: "New notes", status: "published", guid: "urn:germomics:ep", audio_url: "https://media.germomics.com/ep.mp3" });
  });

  it("goes live from Carrel only once it has its audio and transcript, and names its people by slug", async () => {
    await episode("draft");
    const { version } = (await content.get("ep"))!;
    await expect(content.publish("ep", { expectedVersion: version, changeId: "c" })).rejects.toThrow("audio and transcript");
    await insert("UPDATE posts SET transcript = 'WEBVTT' WHERE slug = 'ep'");
    await insert("INSERT INTO people (name, slug) VALUES ('Sample Person', 'sample-person')");
    const named = await save("ep", '---\ntitle: "Ep"\nepisodeNumber: 3\npeople: [{"slug":"sample-person","role":"guest"}]\n---\nNotes', version);
    await expect(save("ep", '---\ntitle: "Ep"\npeople: [{"slug":"nobody"}]\n---\nNotes', named.version)).rejects.toThrow("nobody");
    const live = await content.publish("ep", { expectedVersion: named.version, changeId: "c" });
    expect(await row("ep")).toMatchObject({ status: "published", episode_number: 3, guid: "urn:germomics:ep" });
    expect((await content.get("ep"))!.source).toContain('people: [{"slug":"sample-person","role":"guest"}]');
    expect((await content.unpublish("ep", { expectedVersion: live.version, changeId: "c" })).status).toBe("draft");
  });
});

describe("a page", () => {
  const block = (key: string, value: string) =>
    insert("INSERT INTO content_blocks (key, kind, title, value, status) VALUES (?, 'page', 'About', ?, 'draft')", key, value);
  const page = (key: string) => e.DB.prepare("SELECT * FROM content_blocks WHERE key = ?").bind(key).first<Record<string, any>>();

  it("is listed and read as Markdown under page.<name>, saved with its render and published", async () => {
    await block("page:about", "Old *about*");
    await block("page:llms", "plain text");
    expect((await content.list({ limit: 10 })).items.map((i) => i.id)).toEqual(["page.about"]);
    const doc = (await content.get("page.about"))!;
    expect(doc).toMatchObject({ kind: "page", status: "draft", source: '---\ntitle: "About"\n---\nOld *about*' });
    expect(await content.get("page.llms")).toBeNull();
    const saved = await save("page.about", '---\ntitle: "About us"\n---\nNew *about*', doc.version);
    expect(await page("page:about")).toMatchObject({ title: "About us", value: "New *about*", body_html: "<p>New <em>about</em></p>", render_version: RENDER_VERSION, status: "draft" });
    const published = await content.publish("page.about", { expectedVersion: saved.version, changeId: "c" });
    expect(published.status).toBe("published");
    expect((await content.get("page.about"))!.path).toBe("/about");
  });

  it("is never created, scheduled or taken down", async () => {
    await expect(save("page.new", "x")).rejects.toThrow(RefusedError);
    await block("page:about", "x");
    const { version } = (await content.get("page.about"))!;
    await expect(content.unpublish("page.about", { expectedVersion: version, changeId: "c" })).rejects.toThrow("live route");
    await expect(content.schedule("page.about", { expectedVersion: version, changeId: "c", publishAt: "2030-01-01T00:00:00.000Z" })).rejects.toThrow("live route");
  });
});

describe("preview", () => {
  it("draws the body in a noindex page with the title escaped, falling back to Untitled", async () => {
    const html = await adapter.preview!.render({ source: '---\ntitle: "<b>x"\n---\nbody text' });
    expect(html).not.toContain("<b>x");
    expect(html).toContain("body text");
    expect(html).toContain("noindex");
    expect(await adapter.preview!.render({ source: "b" })).toContain("Untitled");
  });
});

describe("the mounted handler", () => {
  const limiter = { limit: async () => ({ success: true }) };
  const meta = new Request("https://germomics.com/api/carrel/v1/meta", { headers: { Authorization: `Bearer ${"k".repeat(40)}` } });

  it("answers with the configured key and refuses everything when no key is set", async () => {
    const withKey = carrelApi({ ...e, CARREL_SITE_KEY: "k".repeat(40), CARREL_RATE_LIMIT: limiter } as unknown as Env);
    expect(withKey.matches(meta as Request)).toBe(true);
    expect((await withKey.handle(meta.clone() as Request)).status).toBe(200);
    const noKey = carrelApi({ ...e, CARREL_SITE_KEY: undefined, CARREL_RATE_LIMIT: limiter } as unknown as Env);
    expect((await noKey.handle(meta.clone() as Request)).status).toBe(503);
  });
});
