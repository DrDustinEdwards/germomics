import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createSiteApi } from "@dustinedwards/site-api";
import { runConformance } from "@dustinedwards/site-api/conformance";
import { createCarrelAdapter } from "~/lib/carrel/adapter.server";
import { parseSource, renderSource } from "~/lib/carrel/source";
import { applyMigrations } from "./helpers/d1";

const KEY = "k".repeat(40);
const e = env as unknown as Env;
const api = createSiteApi({
  adapter: createCarrelAdapter(e, () => {}),
  key: KEY,
  limiter: { limit: async () => ({ success: true }) },
});
const BASE = "https://germomics.test";
const auth = { Authorization: `Bearer ${KEY}` };

async function call(path: string, init: RequestInit = {}, headers: Record<string, string> = auth) {
  const request = new Request(BASE + path, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) } });
  return api.matches(request) ? api.handle(request) : new Response("not served by the site API", { status: 404 });
}
const json = async (r: Response) => (await r.json()) as Record<string, any>;

const put = (id: string, source: string, expectedVersion: string | null) =>
  call(`/api/carrel/v1/content/${id}/draft`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, expectedVersion, changeId: "chg_1" }),
  });
const post = (path: string, body: unknown) =>
  call(`/api/carrel/v1/content/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeAll(() => applyMigrations(e.DB));

beforeEach(async () => {
  await e.DB.exec("DELETE FROM post_versions");
  await e.DB.exec("DELETE FROM posts");
  const listed = await e.BLOG_IMAGES.list();
  if (listed.objects.length) await e.BLOG_IMAGES.delete(listed.objects.map((o) => o.key));
});

describe("the guard: planted requests must be refused", () => {
  it("does not serve the key off its prefix", async () => {
    expect((await call("/admin")).status).toBe(404);
    expect((await call("/api/carrel/v2/meta")).status).toBe(404);
    expect((await call("/feed/podcast/")).status).toBe(404);
  });

  it("refuses a wrong key and no key", async () => {
    expect((await call("/api/carrel/v1/content", {}, { Authorization: `Bearer ${"x".repeat(40)}` })).status).toBe(401);
    expect((await call("/api/carrel/v1/content", {}, {})).status).toBe(401);
  });

  it("refuses an unknown route", async () => {
    expect((await call("/api/carrel/v1/no-such-route")).status).toBe(404);
    expect((await call("/api/carrel/v1/no-such-route", {}, {})).status).toBe(401);
  });

  it("refuses a stale expectedVersion and leaves the article as it was", async () => {
    const created = await json(await put("stale-test", renderSource({ title: "One", excerpt: null, tags: null, coverImage: null, coverAlt: null, seoTitle: null, seoDescription: null, body: "<p>one</p>" }), null));
    const stale = await put("stale-test", "---\ntitle: \"Two\"\n---\n<p>two</p>", "0".repeat(32));
    expect(stale.status).toBe(409);
    expect((await json(stale)).currentVersion).toBe(created.version);
    const doc = await json(await call("/api/carrel/v1/content/stale-test"));
    expect(doc.title).toBe("One");
  });

  it("refuses a create when the id is taken, and a version for an id that does not exist", async () => {
    await put("taken", "<p>x</p>", null);
    expect((await put("taken", "<p>y</p>", null)).status).toBe(409);
    const missing = await put("never-made", "<p>y</p>", "1".repeat(32));
    expect(missing.status).toBe(409);
    expect((await json(missing)).currentVersion).toBeNull();
  });
});

describe("content", () => {
  it("round-trips an article: create, read, edit, publish, unpublish", async () => {
    const src = '---\ntitle: "Notes on a Pump"\nexcerpt: "A short one."\ntags: ["cholera"]\n---\n<p>Broad Street.</p>';
    const created = await json(await put("pump", src, null));
    expect(created.status).toBe("draft");

    const doc = await json(await call("/api/carrel/v1/content/pump"));
    expect(doc.title).toBe("Notes on a Pump");
    expect(parseSource(doc.source).tags).toEqual(["cholera"]);
    expect(doc.path).toBeNull();

    const edited = await json(await put("pump", src.replace("Broad Street.", "Broad Street, 1854."), doc.version));
    expect(edited.version).not.toBe(doc.version);

    const published = await json(await post("pump/publish", { expectedVersion: edited.version, changeId: "chg_2" }));
    expect(published.status).toBe("published");
    const guid1 = (await e.DB.prepare("SELECT guid FROM posts WHERE slug = 'pump'").first<{ guid: string }>())!.guid;
    expect(guid1).toMatch(/^urn:germomics:/);

    const unpublished = await json(await post("pump/unpublish", { expectedVersion: published.version, changeId: "chg_3" }));
    expect(unpublished.status).toBe("draft");
    const again = await json(await post("pump/publish", { expectedVersion: unpublished.version, changeId: "chg_4" }));
    expect(again.status).toBe("published");
    const guid2 = (await e.DB.prepare("SELECT guid FROM posts WHERE slug = 'pump'").first<{ guid: string }>())!.guid;
    expect(guid2).toBe(guid1); // the guid never changes once published

    const revisions = await json(await call("/api/carrel/v1/content/pump/revisions"));
    expect(revisions.items.length).toBeGreaterThanOrEqual(3);
  });

  it("sanitizes the body on every write, as the editor does", async () => {
    await put("xss", '<p>ok</p><script>alert(1)</script><img src="x" onerror="alert(2)">', null);
    const doc = await json(await call("/api/carrel/v1/content/xss"));
    expect(doc.source).not.toContain("<script");
    expect(doc.source).not.toContain("onerror");
    expect(doc.source).toContain("<p>ok</p>");
  });

  it("schedules into the future and reports it as scheduled", async () => {
    const created = await json(await put("later", "<p>later</p>", null));
    const when = new Date(Date.now() + 86_400_000).toISOString();
    const scheduled = await json(await post("later/schedule", { expectedVersion: created.version, changeId: "chg_5", publishAt: when }));
    expect(scheduled.status).toBe("scheduled");
  });

  it("never lists, reads or overwrites a podcast episode", async () => {
    await e.DB.exec("INSERT INTO posts (kind, title, slug, body, status) VALUES ('episode', 'Ep', 'an-episode', '<p>e</p>', 'published')");
    const list = await json(await call("/api/carrel/v1/content"));
    expect(list.items.map((i: { id: string }) => i.id)).not.toContain("an-episode");
    expect((await call("/api/carrel/v1/content/an-episode")).status).toBe(404);
    expect((await put("an-episode", "<p>x</p>", null)).status).toBe(422);
  });

  it("filters the list by status", async () => {
    const a = await json(await put("a-draft", "<p>a</p>", null));
    const b = await json(await put("a-pub", "<p>b</p>", null));
    await post("a-pub/publish", { expectedVersion: b.version, changeId: "chg_6" });
    const drafts = await json(await call("/api/carrel/v1/content?status=draft"));
    expect(drafts.items.map((i: { id: string }) => i.id)).toEqual([a.id]);
  });

  it("renders a preview without saving anything", async () => {
    const res = await call("/api/carrel/v1/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: '---\ntitle: "T"\n---\n<h1>Head</h1><script>x()</script>' }) });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("<h2");
    expect(html).not.toContain("<script");
    expect((await e.DB.prepare("SELECT COUNT(*) AS n FROM posts").first<{ n: number }>())!.n).toBe(0);
  });
});

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 0x1f, 0x15, 0xc4, 0x89]);

describe("media", () => {
  const upload = (name = "pic.png") =>
    call(`/api/carrel/v1/media?filename=${name}&alt=A%20pixel&changeId=chg_m`, { method: "POST", headers: { "Content-Type": "image/png" }, body: PNG });

  it("uploads, lists, and deletes an unused image", async () => {
    const made = await json(await upload());
    expect(made.url).toMatch(/^https:\/\/images\.germomics\.com\/carrel\//);
    expect(made.alt).toBe("A pixel");
    const list = await json(await call("/api/carrel/v1/media"));
    expect(list.items.map((i: { id: string }) => i.id)).toContain(made.id);
    const del = await call(`/api/carrel/v1/media/${encodeURIComponent(made.id)}?changeId=chg_d`, { method: "DELETE" });
    expect(del.status).toBe(200);
    expect(await e.BLOG_IMAGES.head(made.id)).toBeNull();
  });

  it("refuses to delete an image a post uses, and names the post", async () => {
    const made = await json(await upload());
    await e.DB.prepare("INSERT INTO posts (kind, title, slug, body, status) VALUES ('article', 'Uses it', 'uses-it', ?, 'draft')")
      .bind(`<p><img src="${made.url}" alt="x"></p>`)
      .run();
    const del = await call(`/api/carrel/v1/media/${encodeURIComponent(made.id)}?changeId=chg_d`, { method: "DELETE" });
    expect(del.status).toBe(422);
    const body = await json(del);
    expect(body.usedBy[0]).toMatchObject({ type: "post", id: "uses-it" });
    expect(await e.BLOG_IMAGES.head(made.id)).not.toBeNull();
  });

  it("refuses a type the site did not declare and bytes that are not the declared type", async () => {
    const wrongType = await call("/api/carrel/v1/media?filename=a.txt&changeId=chg_m", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "hi" });
    expect(wrongType.status).toBe(400);
    const fake = await call("/api/carrel/v1/media?filename=a.png&changeId=chg_m", { method: "POST", headers: { "Content-Type": "image/png" }, body: "not a png at all" });
    expect(fake.status).toBe(400);
  });
});

describe("conformance", () => {
  it("passes site-api's own conformance suite", async () => {
    const report = await runConformance({
      baseUrl: BASE,
      key: KEY,
      fetch: ((input: RequestInfo | URL, init?: RequestInit) => api.handle(new Request(input as string, init))) as typeof fetch,
    });
    const failed = report.checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.detail}`);
    expect(failed).toEqual([]);
  });
});
