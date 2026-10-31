import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RouterContextProvider } from "react-router";
import { cloudflareContext } from "~/lib/context.server";
import { createDraft, listVersions, snapshotVersion, updatePost } from "~/lib/admin.server";
import { getPostById } from "~/lib/posts.server";
import { getEpisodePeople, upsertPerson } from "~/lib/people.server";
import { applyMigrations } from "./helpers/d1";

// The post editor's action (app/routes/admin.posts.$id.tsx): what a save, autosave, publish,
// schedule, unpublish, restore and delete store, and what each one refuses. The admin gate in front
// of it is app/routes/admin.tsx with site-runtime's accessAdmin (test/admin-routes.test.ts).
const e = env as unknown as Env;
let action: typeof import("~/routes/admin.posts.$id").action;

function run(id: number, fields: Record<string, string>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  const context = new RouterContextProvider();
  context.set(cloudflareContext, { env: e, ctx: { waitUntil: () => {} } as unknown as ExecutionContext });
  const request = new Request(`https://germomics.com/admin/posts/${id}`, { method: "POST", body: form });
  return action({ params: { id: String(id) }, request, context } as unknown as Parameters<typeof action>[0]);
}
const save = (id: number, intent: string, payload: Record<string, unknown>, extra: Record<string, string> = {}) =>
  run(id, { intent, payload: JSON.stringify(payload), ...extra });
const post = async (id: number) => (await getPostById(e, id))!;
const versionCount = async (id: number) => (await listVersions(e, id)).length;

beforeAll(async () => {
  await applyMigrations(e.DB);
  ({ action } = await import("~/routes/admin.posts.$id"));
}, 120_000);

beforeEach(async () => {
  for (const t of ["episode_people", "people", "post_versions", "posts"]) await e.DB.exec(`DELETE FROM ${t}`);
});

describe("saving", () => {
  it("answers 404 for a post that does not exist", async () => {
    const thrown = await save(4040, "save", {}).catch((x) => x);
    expect((thrown as Response).status).toBe(404);
  });

  it("trims fields, snapshots the previous row, and never writes the body, which Carrel writes", async () => {
    const id = await createDraft(e, "article");
    await updatePost(e, id, { body: "Carrel's *words*", readingTime: 4 });
    const res = await save(id, "save", {
      title: "  Title  ",
      slug: " my-slug ",
      excerpt: "  ",
      body: "<p>an old editor's body</p>",
      tags: ["a", "b"],
      sources: "not a list",
      featured: 1,
      seoTitle: " SEO ",
    });
    expect(res).toEqual({ ok: true, message: "Saved." });
    const p = await post(id);
    expect(p).toMatchObject({ title: "Title", slug: "my-slug", excerpt: null, tags: ["a", "b"], sources: [], featured: true, seoTitle: "SEO", status: "draft", readingTime: 4, body: "Carrel's *words*" });
    expect(await versionCount(id)).toBe(1);
  });

  it("keeps the current slug when none is sent, and calls an empty title Untitled", async () => {
    const id = await createDraft(e, "article");
    const before = (await post(id)).slug;
    await save(id, "save", { title: "   " });
    expect(await post(id)).toMatchObject({ slug: before, title: "Untitled" });
  });

  it("does not snapshot on autosave", async () => {
    const id = await createDraft(e, "article");
    expect(await save(id, "autosave", { title: "Auto" })).toEqual({ ok: true, message: "Saved." });
    expect((await post(id)).title).toBe("Auto");
    expect(await versionCount(id)).toBe(0);
  });

  it("refuses a payload that is not JSON and a slug another post holds, changing nothing", async () => {
    const other = await createDraft(e, "article");
    await updatePost(e, other, { slug: "taken" });
    const id = await createDraft(e, "article");
    await updatePost(e, id, { title: "Before" });
    expect(await run(id, { intent: "save", payload: "{not json" })).toEqual({ ok: false, error: "Bad payload." });
    expect(await save(id, "save", { slug: "taken", title: "After" })).toEqual({ ok: false, error: "Slug already taken." });
    expect((await post(id)).title).toBe("Before");
    expect(await versionCount(id)).toBe(0);
  });

  it("stores episode fields with their defaults and coercions, and links people in order", async () => {
    const id = await createDraft(e, "episode");
    const ada = await upsertPerson(e, { name: "Ada" });
    const bob = await upsertPerson(e, { name: "Bob" });
    await save(id, "save", {
      title: "Ep",
      episodeNumber: "3.7",
      seasonNumber: "",
      episodeType: "weird",
      explicit: true,
      audioUrl: "https://media.germomics.com/a.mp3",
      audioDuration: "61",
      audioPeaks: [1, 2, 3],
      transcript: "WEBVTT",
      chapters: [{ start: 0, title: "Intro" }],
      people: [{ personId: bob, role: "Guest" }, { personId: "x" }, { personId: ada }],
    });
    const p = await post(id);
    expect(p).toMatchObject({ episodeNumber: 3, seasonNumber: null, episodeType: "full", explicit: true, audioDuration: 61, audioByteSize: null, audioMimeType: "audio/mpeg", audioPeaks: [1, 2, 3], transcript: "WEBVTT", keyMoments: [], guests: [] });
    expect(p.chapters).toEqual([{ start: 0, title: "Intro" }]);
    const links = await getEpisodePeople(e, id);
    expect(links.map((l) => [l.person.name, l.role])).toEqual([["Bob", "Guest"], ["Ada", null]]);
    await save(id, "save", { episodeType: "trailer", audioMimeType: "audio/mp4" });
    expect(await post(id)).toMatchObject({ episodeType: "trailer", audioMimeType: "audio/mp4", audioPeaks: null });
    await save(id, "save", { episodeType: "bonus" });
    expect((await post(id)).episodeType).toBe("bonus");
  });

  it("ignores episode fields on an article", async () => {
    const id = await createDraft(e, "article");
    await save(id, "save", { episodeNumber: 4, transcript: "WEBVTT" });
    expect(await post(id)).toMatchObject({ episodeNumber: null, transcript: null });
  });
});

describe("publishing", () => {
  it("publishes with a new guid and date, and keeps both on a later publish", async () => {
    const id = await createDraft(e, "episode");
    expect(await save(id, "publish", { title: "Ep" })).toEqual({ ok: true, message: "Published." });
    const first = await post(id);
    expect(first.status).toBe("published");
    expect(first.guid).toMatch(/^urn:germomics:/);
    expect(first.publishedAt).toBeTruthy();
    expect(first.publishAt).toBeNull();
    expect(await save(id, "unpublish", { title: "Ep" })).toEqual({ ok: true, message: "Moved to draft." });
    expect(await post(id)).toMatchObject({ status: "draft", guid: first.guid, publishAt: null });
    await save(id, "publish", { title: "Ep" });
    expect(await post(id)).toMatchObject({ guid: first.guid, publishedAt: first.publishedAt });
  });

  it("schedules at the chosen time, and refuses a schedule with no time", async () => {
    const id = await createDraft(e, "article");
    expect(await save(id, "schedule", { title: "Later" })).toEqual({ ok: false, error: "Pick a schedule time." });
    expect((await post(id)).status).toBe("draft");
    const at = "2030-01-01T09:00:00.000Z";
    expect(await save(id, "schedule", { title: "Later" }, { publishAt: at })).toEqual({ ok: true, message: "Scheduled." });
    const p = await post(id);
    expect(p).toMatchObject({ status: "published", publishAt: at, publishedAt: at });
    expect(p.guid).toMatch(/^urn:germomics:/);
    await save(id, "schedule", { title: "Later" }, { publishAt: "2031-01-01T09:00:00.000Z" });
    expect((await post(id)).guid).toBe(p.guid);
  });
});

describe("restore and delete", () => {
  it("restores a version after snapshotting the current row", async () => {
    const id = await createDraft(e, "article");
    await updatePost(e, id, { title: "Old" });
    await snapshotVersion(e, await post(id));
    const [v] = await listVersions(e, id);
    await updatePost(e, id, { title: "New" });
    expect(await run(id, { intent: "restore", versionId: String(v.id) })).toEqual({ ok: true, message: "Version restored." });
    expect((await post(id)).title).toBe("Old");
    expect(await versionCount(id)).toBe(2);
  });

  it("deletes the post and redirects to the list", async () => {
    const id = await createDraft(e, "article");
    const thrown = (await run(id, { intent: "delete" }).catch((x) => x)) as Response;
    expect(thrown.status).toBe(302);
    expect(thrown.headers.get("Location")).toBe("/admin/posts");
    expect(await getPostById(e, id)).toBeNull();
  });
});
