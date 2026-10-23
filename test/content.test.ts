import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  bustContentCache,
  isPreviewing,
  listBlocks,
  listSettings,
  loadBlock,
  loadPage,
  loadSettings,
  loadSnippets,
  searchPages,
  setting,
  settingAddress,
  settingNum,
  snippet,
  upsertBlock,
  upsertSetting,
} from "~/lib/content.server";
import { applyMigrations } from "./helpers/d1";

// Site copy and settings live in D1 behind a KV cache. What callers see: a write is visible on the
// next read (the cache is busted), a draft page never reaches the public read, and every missing
// value falls back to the in-code default so a page always renders.
const e = env as unknown as Env;

beforeAll(() => applyMigrations(e.DB));
beforeEach(async () => {
  await e.DB.exec("DELETE FROM settings");
  await e.DB.exec("DELETE FROM content_blocks");
  const { keys } = await e.APP_KV.list();
  await Promise.all(keys.map((k) => e.APP_KV.delete(k.name)));
});

describe("settings", () => {
  it("reads from D1 once, then from the cache, and a write shows on the next read", async () => {
    await upsertSetting(e, "site.tagline", "First");
    expect((await loadSettings(e))["site.tagline"]).toBe("First");
    // A change made behind the cache's back is not seen until the cache is busted.
    await e.DB.prepare("UPDATE settings SET value = 'Sneaky' WHERE key = 'site.tagline'").run();
    expect((await loadSettings(e))["site.tagline"]).toBe("First");
    await upsertSetting(e, "site.tagline", "Second");
    expect((await loadSettings(e))["site.tagline"]).toBe("Second");
    expect((await listSettings(e)).map((s) => [s.key, s.value])).toEqual([["site.tagline", "Second"]]);
  });

  it("falls back to the stored value, then the in-code default, then the caller's", () => {
    expect(setting({ "site.tagline": "Mine" }, "site.tagline")).toBe("Mine");
    expect(setting({}, "site.tagline")).toBe("The purple stain, retold");
    expect(setting({}, "no.such.key", "given")).toBe("given");
    expect(setting({}, "no.such.key")).toBe("");
  });

  it("reads numbers, and falls back when the value is not one", () => {
    expect(settingNum({ n: "7" }, "n", 1)).toBe(7);
    expect(settingNum({ n: "seven" }, "n", 1)).toBe(1);
    expect(settingNum({}, "ratelimit.ai", 1)).toBe(15);
  });

  it("parses the contact address, and gives an empty one for bad JSON", () => {
    expect(settingAddress({ "contact.address": '{"locality":"Here"}' })).toEqual({ locality: "Here" });
    expect(settingAddress({ "contact.address": "{nope" })).toEqual({});
    expect(settingAddress({}).locality).toBe("Stephenville");
  });
});

describe("snippets and pages", () => {
  it("serves snippets whatever their status, cached, with defaults behind them", async () => {
    await upsertBlock(e, { key: "snippet:x", kind: "snippet", value: "X", status: "draft" });
    await upsertBlock(e, { key: "page:p", kind: "page", value: "P", status: "published" });
    const map = await loadSnippets(e);
    expect(map).toEqual({ "snippet:x": "X" });
    expect(await e.APP_KV.get("cache:content:snippets", "json")).toEqual({ "snippet:x": "X" });
    expect(snippet(map, "snippet:x")).toBe("X");
    expect(snippet({}, "snippet:nav.writing")).toBe("Writing");
    expect(snippet({}, "snippet:none", "fb")).toBe("fb");
    expect(snippet({}, "snippet:none")).toBe("");
  });

  it("never serves a draft page publicly, but shows it to an admin preview", async () => {
    await upsertBlock(e, { key: "page:about", kind: "page", title: "Draft about", value: "<p>draft</p>" });
    expect(await loadBlock(e, "page:about")).toBeNull();
    expect(await loadBlock(e, "page:about", { includeDrafts: true })).toEqual({ key: "page:about", title: "Draft about", value: "<p>draft</p>", status: "draft" });
    const page = await loadPage(e, "page:about");
    expect(page.title).toBe("About Germomics");
    expect(page.status).toBe("published");
    expect((await e.APP_KV.list({ prefix: "cache:content:block:" })).keys).toHaveLength(0);
  });

  it("caches a published page and drops it from the cache when the page is saved", async () => {
    await upsertBlock(e, { key: "page:p", kind: "page", title: "T", value: "v1", status: "published" });
    expect((await loadPage(e, "page:p")).value).toBe("v1");
    expect(await e.APP_KV.get("cache:content:block:page:p", "json")).toMatchObject({ value: "v1" });
    await upsertBlock(e, { key: "page:p", kind: "page", value: "v2", status: "published" });
    expect(await loadPage(e, "page:p")).toEqual({ key: "page:p", title: "", value: "v2", status: "published" });
  });

  it("gives an empty page for a key with no row and no default", async () => {
    expect(await loadPage(e, "page:none")).toEqual({ key: "page:none", title: "", value: "", status: "published" });
    expect(await loadPage(e, "page:none", { includeDrafts: true })).toMatchObject({ value: "" });
  });

  it("busts settings, snippets and the named block", async () => {
    for (const k of ["cache:content:settings", "cache:content:snippets", "cache:content:block:page:a", "cache:content:block:page:b"]) await e.APP_KV.put(k, "{}");
    await bustContentCache(e, "page:a");
    expect((await e.APP_KV.list()).keys.map((k) => k.name)).toEqual(["cache:content:block:page:b"]);
    await bustContentCache(e);
    expect((await e.APP_KV.list()).keys.map((k) => k.name)).toEqual(["cache:content:block:page:b"]);
  });

  it("lists every block for the admin", async () => {
    await upsertBlock(e, { key: "snippet:a", kind: "snippet", value: "a" });
    await upsertBlock(e, { key: "page:b", kind: "page", value: "b", title: null });
    expect((await listBlocks(e)).map((b) => b.key).sort()).toEqual(["page:b", "snippet:a"]);
  });
});

describe("searchPages", () => {
  beforeEach(async () => {
    await upsertBlock(e, { key: "page:cholera", kind: "page", title: "Cholera", value: "<p>The Broad Street pump</p>", status: "published" });
    await upsertBlock(e, { key: "page:draft", kind: "page", title: "Hidden", value: "<p>Broad Street draft</p>", status: "draft" });
    await upsertBlock(e, { key: "snippet:s", kind: "snippet", value: "Broad Street snippet", status: "published" });
  });

  it("finds published pages only, matching every word and a prefix of the last", async () => {
    expect((await searchPages(e, "broad stre")).map((p) => p.key)).toEqual(["page:cholera"]);
    expect((await searchPages(e, "broad nothing")).map((p) => p.key)).toEqual([]);
  });

  it("strips search operators instead of failing, and answers nothing for an empty query", async () => {
    expect((await searchPages(e, '"broad" OR (pump)*')).map((p) => p.key)).toEqual([]);
    expect((await searchPages(e, '"pump"*')).map((p) => p.key)).toEqual(["page:cholera"]);
    expect(await searchPages(e, "  !!! ")).toEqual([]);
  });
});

describe("isPreviewing", () => {
  const dev = { ...e, ADMIN_EMAIL: "admin@example.com", ACCESS_DEV_BYPASS: "1" } as unknown as Env;

  it("is true only for the admin, and only with ?preview", async () => {
    expect(await isPreviewing(dev, new Request("http://localhost/about?preview"))).toBe(true);
    expect(await isPreviewing(dev, new Request("http://localhost/about"))).toBe(false);
    expect(await isPreviewing(e, new Request("https://germomics.com/about?preview=1"))).toBe(false);
  });
});
