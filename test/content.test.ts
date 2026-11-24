import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  isPreviewing,
  listBlocks,
  listSettings,
  loadBlock,
  loadPage,
  loadSettings,
  searchPages,
  setting,
  settingAddress,
  settingNum,
  upsertBlock,
  upsertSetting,
} from "~/lib/content.server";
import { applyMigrations } from "./helpers/d1";

// Site copy and settings live in D1. What callers see: a write is visible on the next read, a draft
// page never reaches the public read, and every missing value falls back to the in-code default so a
// page always renders.
const e = env as unknown as Env;

beforeAll(() => applyMigrations(e.DB));
beforeEach(async () => {
  await e.DB.exec("DELETE FROM settings");
  await e.DB.exec("DELETE FROM content_blocks");
});

describe("settings", () => {
  it("shows a write on the next read", async () => {
    await upsertSetting(e, "social.facebook", "First");
    expect((await loadSettings(e))["social.facebook"]).toBe("First");
    await upsertSetting(e, "social.facebook", "Second");
    expect((await loadSettings(e))["social.facebook"]).toBe("Second");
    expect((await listSettings(e)).map((s) => [s.key, s.value])).toEqual([
      ["social.facebook", "Second"],
    ]);
  });

  it("falls back to the stored value, then the in-code default, then the caller's", () => {
    expect(setting({ "social.facebook": "Mine" }, "social.facebook")).toBe("Mine");
    expect(setting({}, "social.facebook")).toBe("Germomics");
    expect(setting({}, "no.such.key", "given")).toBe("given");
    expect(setting({}, "no.such.key")).toBe("");
  });

  it("reads numbers, and falls back when the value is not one", () => {
    expect(settingNum({ n: "7" }, "n", 1)).toBe(7);
    expect(settingNum({ n: "seven" }, "n", 1)).toBe(1);
    expect(settingNum({}, "ratelimit.admin", 1)).toBe(150);
  });

  it("parses the contact address, and gives an empty one for bad JSON", () => {
    expect(settingAddress({ "contact.address": '{"locality":"Here"}' })).toEqual({
      locality: "Here",
    });
    expect(settingAddress({ "contact.address": "{nope" })).toEqual({});
    expect(settingAddress({}).locality).toBe("Stephenville");
  });
});

describe("pages", () => {
  it("never serves a draft page publicly, but shows it to an admin preview", async () => {
    await upsertBlock(e, {
      key: "page:about",
      title: "Draft about",
      value: "<p>draft</p>",
    });
    expect(await loadBlock(e, "page:about")).toBeNull();
    expect(await loadBlock(e, "page:about", { includeDrafts: true })).toEqual({
      key: "page:about",
      title: "Draft about",
      value: "<p>draft</p>",
      html: "<p>draft</p>",
      status: "draft",
      updatedAt: expect.any(String),
    });
    const page = await loadPage(e, "page:about");
    expect(page.title).toBe("About Germomics");
    expect(page.status).toBe("published");
  });

  it("shows a saved page on the next read", async () => {
    await upsertBlock(e, {
      key: "page:p",
      title: "T",
      value: "v1",
      status: "published",
    });
    expect((await loadPage(e, "page:p")).value).toBe("v1");
    await upsertBlock(e, { key: "page:p", value: "v2", status: "published" });
    // Not converted (no render version): the value is still the HTML it was saved as, and is shown as it is.
    expect(await loadPage(e, "page:p")).toEqual({
      key: "page:p",
      title: "",
      value: "v2",
      html: "v2",
      status: "published",
      updatedAt: expect.any(String),
    });
  });

  it("gives an empty page for a key with no row and no default", async () => {
    expect(await loadPage(e, "page:none")).toEqual({
      key: "page:none",
      title: "",
      value: "",
      html: "",
      status: "published",
    });
    expect(await loadPage(e, "page:none", { includeDrafts: true })).toMatchObject({ value: "" });
  });

  it("lists every block for the admin", async () => {
    await upsertBlock(e, { key: "page:a", value: "a" });
    await upsertBlock(e, { key: "page:b", value: "b", title: null });
    expect((await listBlocks(e)).map((b) => b.key).sort()).toEqual(["page:a", "page:b"]);
  });
});

describe("searchPages", () => {
  beforeEach(async () => {
    await upsertBlock(e, {
      key: "page:cholera",
      title: "Cholera",
      value: "<p>The Broad Street pump</p>",
      status: "published",
    });
    await upsertBlock(e, {
      key: "page:draft",
      title: "Hidden",
      value: "<p>Broad Street draft</p>",
      status: "draft",
    });
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
