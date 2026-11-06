import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RouterContextProvider } from "react-router";
import { cloudflareContext } from "~/lib/context.server";
import { getPostById } from "~/lib/posts.server";
import { createDraft, updatePost } from "~/lib/admin.server";
import { getPerson, listPeople, upsertPerson } from "~/lib/people.server";
import { getShowConfig } from "~/lib/show.server";
import { loadBlock, loadSettings, upsertBlock } from "~/lib/content.server";
import { soundbitesForPost } from "~/lib/soundbites.server";
import { resetDb } from "@dustinedwards/devkit/d1";
import { applyMigrations } from "./helpers/d1";

// The admin gate as a route (app/routes/admin.tsx) and the admin route actions: what each one stores
// and what it answers. Posts are written in Carrel (test/carrel*.test.ts); the admin keeps an
// episode's audio and transcript.
const e = env as unknown as Env;

function args(request: Request, params: Record<string, string> = {}, over: Partial<Env> = {}) {
  const context = new RouterContextProvider();
  context.set(cloudflareContext, { env: { ...e, ...over } as Env, ctx: {} as ExecutionContext });
  return { request, params, context } as never;
}
const form = (path: string, fields: Record<string, string>) => {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  return new Request(`https://germomics.com${path}`, { method: "POST", body });
};
const thrown = async (p: unknown) => {
  try {
    await p;
  } catch (x) {
    return x as Response;
  }
  throw new Error("expected a thrown response");
};

type Mod = Record<string, any>;
let gate: Mod, episodes: Mod, episode: Mod, people: Mod, settings: Mod, content: Mod, soundbites: Mod;

beforeAll(async () => {
  await applyMigrations(e.DB);
  [gate, episodes, episode, people, settings, content, soundbites] = await Promise.all([
    import("~/routes/admin"),
    import("~/routes/admin.episodes._index"),
    import("~/routes/admin.episodes.$id"),
    import("~/routes/admin.people._index"),
    import("~/routes/admin.settings._index"),
    import("~/routes/admin.content.$key"),
    import("~/routes/admin.soundbites._index"),
  ]);
}, 120_000);

beforeEach(async () => {
  await resetDb(e.DB);
  const { keys } = await e.APP_KV.list();
  await Promise.all(keys.map((k) => e.APP_KV.delete(k.name)));
});

describe("the admin gate", () => {
  const run = (url: string, over: Partial<Env>, init?: RequestInit) => {
    let reached = false;
    const next = async () => {
      reached = true;
      return new Response("admin page");
    };
    return { reached: () => reached, result: gate.middleware[0](args(new Request(url, init), {}, over), next) };
  };
  const admin = { ADMIN_EMAIL: "admin@example.com", ACCESS_DEV_BYPASS: "1" };

  it("answers 403 and never reaches the admin route without a verified session", async () => {
    const { reached, result } = run("https://germomics.com/admin", { ACCESS_TEAM_DOMAIN: undefined, ACCESS_AUD: undefined, ACCESS_DEV_BYPASS: undefined });
    const res = await thrown(result);
    expect(res.status).toBe(403);
    expect(reached()).toBe(false);
  });

  it("passes the admin through to the route, the answer private, no-store and noindex", async () => {
    const { reached, result } = run("http://localhost/admin", admin);
    const res = await result;
    expect(await res.text()).toBe("admin page");
    expect(reached()).toBe(true);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it("refuses a cross-origin write, even from the admin, before any admin route runs", async () => {
    const { reached, result } = run("http://localhost/admin/upload", admin, { method: "POST", headers: { Origin: "https://evil.example" } });
    expect((await thrown(result)).status).toBe(403);
    expect(reached()).toBe(false);
  });
});

describe("episode audio", () => {
  it("starts an episode as a draft, then stores its audio and transcript, snapshotting the row and keeping the guid", async () => {
    const made = await thrown(episodes.action(args(form("/admin/episodes", {}))));
    const id = Number(made.headers.get("Location")!.split("/").pop());
    expect((await getPostById(e, id))!).toMatchObject({ kind: "episode", status: "draft" });
    await updatePost(e, id, { guid: "urn:germomics:sample" });
    const payload = JSON.stringify({ audioUrl: " https://media.example.com/ep.mp3 ", audioDuration: 61.9, audioByteSize: 1000, audioMimeType: "", audioPeaks: [1, 2], transcript: "WEBVTT\n" });
    expect(await episode.action(args(form(`/admin/episodes/${id}`, { payload }), { id: String(id) }))).toMatchObject({ ok: true });
    expect((await getPostById(e, id))!).toMatchObject({
      audioUrl: "https://media.example.com/ep.mp3",
      audioDuration: 61,
      audioByteSize: 1000,
      audioMimeType: "audio/mpeg",
      audioPeaks: [1, 2],
      transcript: "WEBVTT",
      guid: "urn:germomics:sample",
    });
    expect((await e.DB.prepare("SELECT COUNT(*) AS n FROM post_versions").first<{ n: number }>())!.n).toBe(1);
    // An article is not an episode here.
    const article = await createDraft(e, "article");
    expect((await thrown(episode.loader(args(new Request(`https://germomics.com/admin/episodes/${article}`), { id: String(article) })))).status).toBe(404);
  });
});

describe("people actions", () => {
  it("saves a person with only the links that have a URL, and ignores links that are not JSON", async () => {
    await people.action(args(form("/admin/people", { name: " Ada ", role: "Guest", links: JSON.stringify([{ label: "Site", url: "https://a.example" }, { label: "Empty", url: "  " }]) })));
    const [ada] = await listPeople(e);
    expect(ada).toMatchObject({ name: "Ada", role: "Guest", links: [{ label: "Site", url: "https://a.example" }] });
    expect(await people.action(args(form("/admin/people", { id: String(ada.id), name: "Ada L", links: "{broken" })))).toEqual({ ok: true, message: "Saved." });
    expect(await getPerson(e, ada.id)).toMatchObject({ name: "Ada L", links: [] });
  });

  it("deletes a person", async () => {
    const id = await upsertPerson(e, { name: "Gone" });
    expect(await people.action(args(form("/admin/people", { intent: "delete", id: String(id) })))).toEqual({ ok: true, message: "Deleted." });
    expect(await getPerson(e, id)).toBeNull();
  });
});

describe("settings actions", () => {
  it("saves only the s:-prefixed site settings", async () => {
    const res = await settings.action(args(form("/admin/settings", { _form: "settings", "s:site.tagline": "New tagline", title: "Not a setting" })));
    expect(res).toEqual({ ok: true, message: "Site settings saved." });
    const map = await loadSettings(e);
    expect(map["site.tagline"]).toBe("New tagline");
    expect(map).not.toHaveProperty("title");
  });

  it("saves the show row, with defaults for blanks and only named hosts", async () => {
    const res = await settings.action(
      args(
        form("/admin/settings", {
          title: "  ",
          description: " About microbes ",
          itunesType: "serial",
          explicit: "on",
          categories: JSON.stringify([{ category: "History" }]),
          hosts: JSON.stringify([{ name: "Dustin", role: "Host" }, { name: " " }]),
          fundingUrl: " ",
        }),
      ),
    );
    expect(res).toEqual({ ok: true, message: "Settings saved." });
    expect(await getShowConfig(e)).toMatchObject({
      title: "Germomics",
      description: "About microbes",
      itunesType: "serial",
      explicit: true,
      appleCategory: "History",
      language: "en-us",
      fundingUrl: null,
      hosts: [{ name: "Dustin", role: "Host" }],
    });
  });

  it("falls back to episodic, Science and no hosts when those fields are missing or broken", async () => {
    await settings.action(args(form("/admin/settings", { title: "G", itunesType: "weird", categories: "{bad", hosts: "{bad" })));
    expect(await getShowConfig(e)).toMatchObject({ itunesType: "episodic", explicit: false, appleCategory: "Science", categories: [], hosts: null });
  });
});

describe("content block action", () => {
  it("saves a Markdown page's title and status but never its text, which Carrel writes, and a snippet always published", async () => {
    await upsertBlock(e, { key: "page:about", kind: "page", title: "Old", value: "Carrel's *text*", status: "draft" });
    const before = "Carrel's *text*";
    await content.action(args(form("/admin/content/page:about", { title: "About", value: "<p>v</p>" }), { key: "page:about" }));
    expect(await loadBlock(e, "page:about", { includeDrafts: true })).toMatchObject({ title: "About", status: "draft", value: before });
    await content.action(args(form("/admin/content/page:about", { status: "published" }), { key: "page:about" }));
    expect(await loadBlock(e, "page:about")).toMatchObject({ status: "published", title: "", value: before });
    await content.action(args(form("/admin/content/snippet:x", { value: "Hi", status: "draft" }), { key: "snippet:x" }));
    expect(await loadBlock(e, "snippet:x")).toMatchObject({ status: "published" });
  });
});

describe("soundbite actions", () => {
  it("saves, updates and deletes a soundbite", async () => {
    const ep = await createDraft(e, "episode");
    await soundbites.action(args(form("/admin/soundbites", { postId: String(ep), startSeconds: "12", durationSeconds: "30", title: "Clip" })));
    const [clip] = await soundbitesForPost(e, ep);
    expect(clip).toMatchObject({ startSeconds: 12, durationSeconds: 30, title: "Clip" });
    await soundbites.action(args(form("/admin/soundbites", { id: String(clip.id), postId: String(ep), startSeconds: "5", durationSeconds: "10", title: "" })));
    expect((await soundbitesForPost(e, ep))[0]).toMatchObject({ id: clip.id, startSeconds: 5, title: null });
    expect(await soundbites.action(args(form("/admin/soundbites", { intent: "delete", id: String(clip.id) })))).toEqual({ ok: true, message: "Deleted." });
    expect(await soundbitesForPost(e, ep)).toEqual([]);
  });
});
