import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createSiteApi, type PublishEvent } from "@dustinedwards/site-api";
import { runConformance } from "@dustinedwards/site-api/conformance";
import { d1SiteApiStore } from "@dustinedwards/site-api/store";
import { createCarrelAdapter } from "~/lib/carrel/adapter.server";
import { parseSource } from "~/lib/carrel/source";
import { applyMigrations } from "./helpers/d1";

// Carrel's site API as the Worker mounts it, with site-api's D1 store (safe retries, preview links), against the real
// migrations: the guard, the round trips Carrel makes, and site-api's own conformance suite.

const KEY = "k".repeat(40);
const e = env as unknown as Env;
/** What the publish hooks heard, as IndexNow, the page purge and the webmentions would. */
const heard: PublishEvent[] = [];
const api = createSiteApi({
  adapter: createCarrelAdapter(e, () => {}),
  key: KEY,
  limiter: { limit: async () => ({ success: true }) },
  store: d1SiteApiStore(e.DB),
  hooks: [{ name: "spy", on: ["publish", "update", "unpublish", "delete", "trash", "restore", "rename"], run: (event) => void heard.push(event) }],
  log: () => {},
});
const BASE = "https://germomics.test";
const auth = { Authorization: `Bearer ${KEY}` };

async function call(path: string, init: RequestInit = {}, headers: Record<string, string> = auth) {
  const request = new Request(BASE + path, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) } });
  return api.matches(request) ? api.handle(request) : new Response("not served by the site API", { status: 404 });
}
/** A fresh change id: with the store, one id on two different requests is refused. */
const cid = () => `chg_${crypto.randomUUID()}`;
const json = async (r: Response) => (await r.json()) as Record<string, any>;

const put = (id: string, source: string, expectedVersion: string | null) =>
  call(`/api/carrel/v1/content/${id}/draft`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source, expectedVersion, changeId: cid() }),
  });
const post = (path: string, body: unknown) =>
  call(`/api/carrel/v1/content/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// Prelum loads on first use; loaded here, so the first test's time is its own.
beforeAll(async () => {
  await applyMigrations(e.DB);
  await import("@drdustinedwards/site-helpers/render/nomath");
}, 60_000);

beforeEach(async () => {
  await e.DB.exec("DELETE FROM post_versions");
  await e.DB.exec("DELETE FROM posts");
  await e.DB.exec("DELETE FROM media");
  await e.DB.exec("DELETE FROM site_api_writes");
  heard.length = 0;
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
    const created = await json(await put("stale-test", '---\ntitle: "One"\n---\n<p>one</p>', null));
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
    expect(parseSource(doc.source, "article").post?.tags).toEqual(["cholera"]);
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

  it("never turns raw HTML in a source into markup", async () => {
    await put("xss", 'ok\n\n<script>alert(1)</script><img src="x" onerror="alert(2)">', null);
    const html = (await e.DB.prepare("SELECT body_html FROM posts WHERE slug = 'xss'").first<{ body_html: string }>())!.body_html;
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror");
    expect(html).toContain("<p>ok</p>");
  });

  it("renders a preview without saving anything", async () => {
    const res = await call("/api/carrel/v1/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source: '---\ntitle: "T"\n---\n# Head\n\n<script>x()</script>' }) });
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/<h[23]/);
    expect(html).toContain("noindex");
    expect(html).not.toContain("<script");
    expect((await e.DB.prepare("SELECT COUNT(*) AS n FROM posts").first<{ n: number }>())!.n).toBe(0);
  });

  it("renames a live post, the old address and its feed files redirecting to the new one, the guid kept", async () => {
    const made = await json(await put("old-name", '---\ntitle: "Pump"\n---\nBody.', null));
    const live = await json(await post("old-name/publish", { expectedVersion: made.version, changeId: cid() }));
    const guid = (await e.DB.prepare("SELECT guid FROM posts WHERE slug = 'old-name'").first<{ guid: string }>())!.guid;
    heard.length = 0;
    const renamed = await json(await post("old-name/rename", { newId: "new-name", expectedVersion: live.version, changeId: cid() }));
    expect(renamed).toMatchObject({ id: "new-name", status: "published", previousPath: "/old-name" });
    expect(heard.map((h) => [h.action, h.previousPath, h.path])).toEqual([["rename", "/old-name", "/new-name"]]);
    expect((await e.DB.prepare("SELECT guid FROM posts WHERE slug = 'new-name'").first<{ guid: string }>())!.guid).toBe(guid);
    const { renamedPostRedirect } = await import("~/lib/posts.server");
    expect((await renamedPostRedirect(e, "old-name", "/transcript.vtt"))?.headers.get("Location")).toBe("/new-name/transcript.vtt");
    // A taken slug is refused; the history moved with the post.
    await put("other", "x", null);
    expect((await post("new-name/rename", { newId: "other", expectedVersion: renamed.version, changeId: cid() })).status).toBe(422);
    expect((await json(await call("/api/carrel/v1/content/new-name/revisions"))).items.length).toBeGreaterThanOrEqual(2);
  });

  it("trashes a live post off the site, lists it only in the trash, restores it as a draft and deletes it only from there", async () => {
    const made = await json(await put("binned", '---\ntitle: "Binned"\n---\nBody.', null));
    const live = await json(await post("binned/publish", { expectedVersion: made.version, changeId: cid() }));
    const trashed = await json(await post("binned/trash", { expectedVersion: live.version, changeId: cid() }));
    expect(trashed.status).toBe("draft");
    const { getPostBySlug } = await import("~/lib/posts.server");
    expect(await getPostBySlug(e, "binned")).toBeNull();
    const ids = async (q: string) => (await json(await call(`/api/carrel/v1/content${q}`))).items.map((i: { id: string }) => i.id);
    expect(await ids("")).not.toContain("binned");
    expect(await ids("?trashed=true")).toEqual(["binned"]);
    expect((await post("binned/publish", { expectedVersion: trashed.version, changeId: cid() })).status).toBe(422);
    const restored = await json(await post("binned/restore", { expectedVersion: trashed.version, changeId: cid() }));
    expect(restored.status).toBe("draft");
    const del = (version: string) => call(`/api/carrel/v1/content/binned?expectedVersion=${version}&changeId=${cid()}`, { method: "DELETE" });
    expect((await del(restored.version)).status).toBe(422);
    const again = await json(await post("binned/trash", { expectedVersion: restored.version, changeId: cid() }));
    expect((await del(again.version)).status).toBe(200);
    expect(await ids("?trashed=true")).toEqual([]);
  });

  it("serves a preview link to anyone holding it, noindex, until it is revoked", async () => {
    await put("draft-only", '---\ntitle: "Not live yet"\n---\nA sample draft.', null);
    const link = await json(await call("/api/carrel/v1/preview-links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "draft-only", changeId: cid() }) }));
    const open = () => api.servePreviewLink(new Request(link.url));
    expect(api.matchesPreviewLink(new Request(link.url))).toBe(true);
    const page = await open();
    expect(page.headers.get("x-robots-tag")).toContain("noindex");
    expect(await page.text()).toContain("A sample draft.");
    const [{ id }] = (await json(await call("/api/carrel/v1/preview-links?id=draft-only"))).items;
    await call(`/api/carrel/v1/preview-links/${id}?changeId=${cid()}`, { method: "DELETE" });
    expect((await open()).status).toBe(410);
  });

  it("lets the hooks hear a scheduled post go live once, when its time comes", async () => {
    const made = await json(await put("later", '---\ntitle: "Later"\n---\nBody.', null));
    const at = new Date(Date.now() + 60_000).toISOString();
    await post("later/schedule", { expectedVersion: made.version, changeId: "chg_sched", publishAt: at });
    expect((await api.runSchedules({ now: new Date() })).applied).toHaveLength(0);
    // The minute passes: the post goes live by the clock, and the next pass tells the hooks, once.
    const past = new Date(Date.now() - 1_000).toISOString();
    await e.DB.prepare("UPDATE posts SET publish_at = ?, published_at = ? WHERE slug = 'later'").bind(past, past).run();
    heard.length = 0;
    expect((await api.runSchedules({ now: new Date() })).applied).toHaveLength(1);
    expect(heard.map((h) => [h.action, h.trigger, h.changeId, h.path])).toEqual([["publish", "schedule", "chg_sched", "/later"]]);
    expect((await api.runSchedules({ now: new Date() })).applied).toHaveLength(0);
  });
});

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 0x1f, 0x15, 0xc4, 0x89]);

describe("media", () => {
  const upload = (name = "pic.png") =>
    call(`/api/carrel/v1/media?filename=${name}&alt=A%20pixel&changeId=${cid()}`, { method: "POST", headers: { "Content-Type": "image/png" }, body: PNG });

  it("uploads, lists, and deletes an unused image", async () => {
    const made = await json(await upload());
    expect(made.url).toMatch(/^https:\/\/images\.germomics\.com\/carrel\//);
    expect(made.alt).toBe("A pixel");
    const list = await json(await call("/api/carrel/v1/media"));
    expect(list.items.map((i: { id: string }) => i.id)).toContain(made.id);
    const del = await call(`/api/carrel/v1/media/${encodeURIComponent(made.id)}?changeId=${cid()}`, { method: "DELETE" });
    expect(del.status).toBe(200);
    expect(await e.BLOG_IMAGES.head(made.id)).toBeNull();
  });

  it("refuses to delete an image a post uses, and names the post", async () => {
    const made = await json(await upload());
    await e.DB.prepare("INSERT INTO posts (kind, title, slug, body, status) VALUES ('article', 'Uses it', 'uses-it', ?, 'draft')")
      .bind(`<p><img src="${made.url}" alt="x"></p>`)
      .run();
    const del = await call(`/api/carrel/v1/media/${encodeURIComponent(made.id)}?changeId=${cid()}`, { method: "DELETE" });
    expect(del.status).toBe(422);
    const body = await json(del);
    expect(body.usedBy[0]).toMatchObject({ type: "post", id: "uses-it" });
    expect(await e.BLOG_IMAGES.head(made.id)).not.toBeNull();
  });

  it("answers bytes it already holds with that file, storing nothing new", async () => {
    const made = await json(await upload());
    const again = await upload("other-name.png");
    expect(again.status).toBe(200);
    expect(await json(again)).toMatchObject({ id: made.id, duplicateOf: made.id });
    expect((await e.BLOG_IMAGES.list()).objects).toHaveLength(1);
  });

  it("refuses a type the site did not declare and bytes that are not the declared type", async () => {
    const wrongType = await call(`/api/carrel/v1/media?filename=a.txt&changeId=${cid()}`, { method: "POST", headers: { "Content-Type": "text/plain" }, body: "hi" });
    expect(wrongType.status).toBe(400);
    const fake = await call(`/api/carrel/v1/media?filename=a.png&changeId=${cid()}`, { method: "POST", headers: { "Content-Type": "image/png" }, body: "not a png at all" });
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
