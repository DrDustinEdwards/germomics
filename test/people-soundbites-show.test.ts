import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  deletePerson,
  getEpisodeGuests,
  getEpisodePeople,
  getPerson,
  getPersonBySlug,
  listPeople,
  postsByPerson,
  setEpisodePeople,
  upsertPerson,
} from "~/lib/people.server";
import { deleteSoundbite, soundbitesByEpisode, soundbitesForPost, upsertSoundbite } from "~/lib/soundbites.server";
import { DEFAULT_SHOW, getShowConfig, upsertShowConfig } from "~/lib/show.server";
import { createDraft, updatePost } from "~/lib/admin.server";
import { getPostById } from "~/lib/posts.server";
import { resetDb } from "@dustinedwards/devkit/d1";
import { applyMigrations } from "./helpers/d1";

// The admin writers behind people, soundbites and the show row, as the editor, the episode page
// and the feed read them back.
const e = env as unknown as Env;

beforeAll(() => applyMigrations(e.DB));
beforeEach(async () => {
  await resetDb(e.DB);
});

describe("people", () => {
  it("creates a person with a derived slug and trimmed fields, and numbers clashing slugs", async () => {
    const a = await upsertPerson(e, { name: "  Ada Lovelace ", role: " Guest ", bio: "  ", photo: " p.png ", photoAlt: "", links: [{ label: "Site", url: "https://a.example" }] });
    expect(await getPerson(e, a)).toMatchObject({ name: "Ada Lovelace", slug: "ada-lovelace", role: "Guest", bio: null, photo: "p.png", photoAlt: null, links: [{ label: "Site", url: "https://a.example" }] });
    const b = await upsertPerson(e, { name: "Ada Lovelace" });
    const c = await upsertPerson(e, { name: "Ada  Lovelace!" });
    expect((await getPerson(e, b))!.slug).toBe("ada-lovelace-2");
    expect((await getPerson(e, c))!.slug).toBe("ada-lovelace-3");
    expect((await getPerson(e, b))!.links).toEqual([]);
  });

  it("names a nameless person Unnamed, and slugs a name with no letters as person", async () => {
    const id = await upsertPerson(e, { name: "   " });
    expect(await getPerson(e, id)).toMatchObject({ name: "Unnamed", slug: "unnamed" });
    const sym = await upsertPerson(e, { name: "!!!" });
    expect((await getPerson(e, sym))!.slug).toBe("person");
  });

  it("updates in place, keeping the slug, and deletes", async () => {
    const id = await upsertPerson(e, { name: "Old Name" });
    expect(await upsertPerson(e, { id, name: "New Name", role: "Host" })).toBe(id);
    expect(await getPerson(e, id)).toMatchObject({ name: "New Name", slug: "old-name", role: "Host" });
    expect((await getPersonBySlug(e, "old-name"))!.id).toBe(id);
    expect((await listPeople(e)).map((p) => p.name)).toEqual(["New Name"]);
    await deletePerson(e, id);
    expect(await getPerson(e, id)).toBeNull();
    expect(await getPersonBySlug(e, "old-name")).toBeNull();
  });

  it("lists people by name", async () => {
    await upsertPerson(e, { name: "Zed" });
    await upsertPerson(e, { name: "Amy" });
    expect((await listPeople(e)).map((p) => p.name)).toEqual(["Amy", "Zed"]);
  });

  it("replaces an episode's links, in order, and resolves them to guests", async () => {
    const ep = await createDraft(e, "episode");
    const ada = await upsertPerson(e, { name: "Ada", role: "Mathematician", bio: "B", photo: "a.png", photoAlt: "Ada", links: [{ label: "L", url: "u" }] });
    const bob = await upsertPerson(e, { name: "Bob", role: "Default role" });
    await setEpisodePeople(e, ep, [{ personId: bob, role: " ", sort: 1 }, { personId: ada, role: " Co-host ", sort: 0 }]);
    const links = await getEpisodePeople(e, ep);
    expect(links.map((l) => [l.person.name, l.role, l.sort])).toEqual([["Ada", "Co-host", 0], ["Bob", null, 1]]);
    const guests = await getEpisodeGuests(e, (await getPostById(e, ep))!);
    expect(guests).toEqual([
      { name: "Ada", slug: "ada", role: "Co-host", bio: "B", photo: "a.png", photoAlt: "Ada", links: [{ label: "L", url: "u" }] },
      { name: "Bob", slug: "bob", role: "Default role", bio: null, photo: null, photoAlt: null, links: [] },
    ]);
    expect((await postsByPerson(e, "ada")).map((p) => p.id)).toEqual([ep]);
    await setEpisodePeople(e, ep, []);
    expect(await getEpisodePeople(e, ep)).toEqual([]);
    expect(await postsByPerson(e, "ada")).toEqual([]);
  });

  it("skips a link whose person is gone", async () => {
    const ep = await createDraft(e, "episode");
    const ada = await upsertPerson(e, { name: "Ada" });
    await setEpisodePeople(e, ep, [{ personId: ada, sort: 0 }]);
    await e.DB.exec("PRAGMA foreign_keys = OFF");
    await e.DB.prepare("DELETE FROM people WHERE id = ?").bind(ada).run();
    await e.DB.exec("PRAGMA foreign_keys = ON");
    expect(await getEpisodePeople(e, ep)).toEqual([]);
  });

  it("falls back to the legacy guests column, and gives articles no guests", async () => {
    const ep = await createDraft(e, "episode");
    await updatePost(e, ep, { guests: [{ name: "Old Guest", role: "Historian", bio: "Bio", img: "g.png", link: "https://g.example" }, { name: "Plain" }] });
    expect(await getEpisodeGuests(e, (await getPostById(e, ep))!)).toEqual([
      { name: "Old Guest", slug: "old-guest", role: "Historian", bio: "Bio", photo: "g.png", photoAlt: null, link: "https://g.example", links: [{ label: "Website", url: "https://g.example" }] },
      { name: "Plain", slug: "plain", role: null, bio: null, photo: null, photoAlt: null, link: null, links: [] },
    ]);
    const art = await createDraft(e, "article");
    await updatePost(e, art, { guests: [{ name: "X" }] });
    expect(await getEpisodeGuests(e, (await getPostById(e, art))!)).toEqual([]);
  });

  it("finds no episodes for an unknown person, and only episodes for a known one", async () => {
    expect(await postsByPerson(e, "nobody")).toEqual([]);
    const ada = await upsertPerson(e, { name: "Ada" });
    expect(await postsByPerson(e, "ada")).toEqual([]);
    const art = await createDraft(e, "article");
    await setEpisodePeople(e, art, [{ personId: ada, sort: 0 }]);
    expect(await postsByPerson(e, "ada")).toEqual([]);
  });
});

describe("soundbites", () => {
  it("clamps the start and duration, trims the title, and reads them back in order", async () => {
    const ep = await createDraft(e, "episode");
    const a = await upsertSoundbite(e, { postId: ep, startSeconds: 90.7, durationSeconds: 0.4, title: "  Late  " });
    await upsertSoundbite(e, { postId: ep, startSeconds: -5, durationSeconds: 30, title: " " });
    const list = await soundbitesForPost(e, ep);
    expect(list.map((s) => [s.startSeconds, s.durationSeconds, s.title])).toEqual([[0, 30, null], [90, 1, "Late"]]);
    expect(await upsertSoundbite(e, { id: a, postId: ep, startSeconds: NaN, durationSeconds: 12 })).toBe(a);
    expect((await soundbitesForPost(e, ep)).find((s) => s.id === a)).toMatchObject({ startSeconds: 0, durationSeconds: 12, title: null });
    await deleteSoundbite(e, a);
    expect(await soundbitesForPost(e, ep)).toHaveLength(1);
  });

  it("groups soundbites by episode for the feed", async () => {
    const one = await createDraft(e, "episode");
    const two = await createDraft(e, "episode");
    await upsertSoundbite(e, { postId: two, startSeconds: 5, durationSeconds: 10 });
    await upsertSoundbite(e, { postId: one, startSeconds: 20, durationSeconds: 10 });
    await upsertSoundbite(e, { postId: one, startSeconds: 10, durationSeconds: 10 });
    const map = await soundbitesByEpisode(e);
    expect([...map.keys()].sort()).toEqual([one, two].sort());
    expect(map.get(one)!.map((s) => s.startSeconds)).toEqual([10, 20]);
    expect(map.get(two)!.map((s) => s.startSeconds)).toEqual([5]);
  });
});

describe("show config", () => {
  it("falls back to the defaults with no row, seeds from them on the first write, then updates", async () => {
    expect(await getShowConfig(e)).toBe(DEFAULT_SHOW);
    await upsertShowConfig(e, { title: "Renamed" });
    const first = await getShowConfig(e);
    expect(first).toMatchObject({ title: "Renamed", author: DEFAULT_SHOW.author, categories: DEFAULT_SHOW.categories, itunesType: "episodic" });
    await upsertShowConfig(e, { description: "New description" });
    const second = await getShowConfig(e);
    expect(second).toMatchObject({ id: first.id, title: "Renamed", description: "New description" });
    expect((await e.DB.prepare("SELECT COUNT(*) AS n FROM show_config").first<{ n: number }>())!.n).toBe(1);
  });
});
