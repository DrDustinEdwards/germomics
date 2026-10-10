import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createDraft,
  deletePost,
  duplicatePost,
  generateGuid,
  getVersion,
  isSlugAvailable,
  listAllPosts,
  listVersions,
  restoreVersion,
  snapshotVersion,
  updatePost,
} from "~/lib/admin.server";
import { getPostById } from "~/lib/posts.server";
import { applyMigrations } from "./helpers/d1";

// The admin editor's writes to D1: drafts, saves, version snapshots and restores, duplicates, and
// the slug check. The guid is the feed's permanent episode id, so a restore or a duplicate must never
// carry one over or rewrite it.
const e = env as unknown as Env;
const post = async (id: number) => (await getPostById(e, id))!;

beforeAll(() => applyMigrations(e.DB));
beforeEach(async () => {
  await e.DB.exec("DELETE FROM post_versions");
  await e.DB.exec("DELETE FROM posts");
});

describe("drafts and saves", () => {
  it("creates an untitled draft of the asked kind with a unique placeholder slug", async () => {
    const a = await createDraft(e, "episode");
    const b = await createDraft(e, "article");
    expect(await post(a)).toMatchObject({ kind: "episode", title: "Untitled", status: "draft", guid: null });
    expect((await post(a)).slug).toMatch(/^untitled-\d+$/);
    expect((await post(b)).kind).toBe("article");
  });

  it("updates the named fields and stamps updated_at", async () => {
    const id = await createDraft(e, "article");
    await e.DB.prepare("UPDATE posts SET updated_at = '2000-01-01 00:00:00' WHERE id = ?").bind(id).run();
    await updatePost(e, id, { title: "Named", excerpt: "Ex" });
    const p = await post(id);
    expect(p).toMatchObject({ title: "Named", excerpt: "Ex", status: "draft" });
    expect(String(p.updatedAt) > "2000-01-01 00:00:00").toBe(true);
  });

  it("deletes a post", async () => {
    const id = await createDraft(e, "article");
    await deletePost(e, id);
    expect(await getPostById(e, id)).toBeNull();
  });

  it("lists every post, most recently updated first", async () => {
    const a = await createDraft(e, "article");
    const b = await createDraft(e, "episode");
    await e.DB.prepare("UPDATE posts SET updated_at = '2001-01-01 00:00:00' WHERE id = ?").bind(b).run();
    await e.DB.prepare("UPDATE posts SET updated_at = '2002-01-01 00:00:00' WHERE id = ?").bind(a).run();
    expect((await listAllPosts(e)).map((p) => p.id)).toEqual([a, b]);
  });
});

describe("versions", () => {
  it("snapshots a row, lists it newest first, and returns the full snapshot", async () => {
    const id = await createDraft(e, "article");
    await updatePost(e, id, { title: "One" });
    await snapshotVersion(e, await post(id));
    await updatePost(e, id, { title: "Two" });
    await snapshotVersion(e, await post(id));
    await e.DB.prepare("UPDATE post_versions SET created_at = '2000-01-01 00:00:00' WHERE snapshot LIKE '%\"One\"%'").run();
    const versions = await listVersions(e, id);
    expect(versions).toHaveLength(2);
    expect((await getVersion(e, versions[0].id))!.title).toBe("Two");
    expect((await getVersion(e, versions[1].id))!.title).toBe("One");
    expect(await getVersion(e, 999_999)).toBeNull();
    expect(await listVersions(e, id + 1000)).toEqual([]);
  });

  it("keeps the list to the newest 50", async () => {
    const id = await createDraft(e, "article");
    const p = await post(id);
    for (let i = 0; i < 52; i++) await snapshotVersion(e, p);
    expect(await listVersions(e, id)).toHaveLength(50);
  });

  it("restores a snapshot's content but never its id, guid or creation time", async () => {
    const id = await createDraft(e, "episode");
    await updatePost(e, id, { title: "Old title", body: "<p>old</p>", guid: "urn:germomics:old-guid" });
    await snapshotVersion(e, await post(id));
    const [v] = await listVersions(e, id);
    await updatePost(e, id, { title: "New title", body: "<p>new</p>", guid: "urn:germomics:live-guid" });
    const before = await post(id);
    await restoreVersion(e, id, v.id);
    const after = await post(id);
    expect(after).toMatchObject({ id, title: "Old title", body: "<p>old</p>", guid: "urn:germomics:live-guid", createdAt: before.createdAt });
  });

  it("does nothing when the version does not exist", async () => {
    const id = await createDraft(e, "article");
    await updatePost(e, id, { title: "Stays" });
    await restoreVersion(e, id, 424242);
    expect((await post(id)).title).toBe("Stays");
  });
});

describe("duplicatePost", () => {
  it("copies the content as a fresh draft with no guid or publish dates", async () => {
    const id = await createDraft(e, "episode");
    await updatePost(e, id, {
      title: "Ep",
      slug: "ep",
      body: "<p>b</p>",
      status: "published",
      guid: "urn:germomics:x",
      publishedAt: "2026-01-01T00:00:00.000Z",
      publishAt: "2026-01-01T00:00:00.000Z",
      tags: ["t"],
    });
    const copyId = await duplicatePost(e, id);
    expect(copyId).not.toBe(id);
    const copy = await post(copyId);
    expect(copy).toMatchObject({ kind: "episode", title: "Ep (copy)", body: "<p>b</p>", status: "draft", guid: null, publishedAt: null, publishAt: null, tags: ["t"] });
    expect(copy.slug).toMatch(/^ep-copy-\d+$/);
    expect((await post(id)).guid).toBe("urn:germomics:x");
  });

  it("answers 404 for a post that does not exist", async () => {
    const thrown = await duplicatePost(e, 31337).catch((x) => x);
    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(404);
  });
});

describe("slugs and guids", () => {
  it("calls a slug available unless another post holds it", async () => {
    const a = await createDraft(e, "article");
    await updatePost(e, a, { slug: "taken" });
    const b = await createDraft(e, "article");
    expect(await isSlugAvailable(e, "taken", a)).toBe(true);
    expect(await isSlugAvailable(e, "taken", b)).toBe(false);
    expect(await isSlugAvailable(e, "free", b)).toBe(true);
  });

  it("makes a new urn guid every time", () => {
    const g = generateGuid();
    expect(g).toMatch(/^urn:germomics:[0-9a-f-]{36}$/);
    expect(generateGuid()).not.toBe(g);
  });
});
