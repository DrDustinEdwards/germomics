import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { applyMigrations } from "./helpers/d1";

// content-defaults.ts is generated from the migration seed and is every page's fallback when a row
// is missing. It mirrors a source of truth, so the test derives the seed from the migrations and
// fails both ways: a default with no seed row, and a seed row with no default (rule 3.4). Counts
// guard against an empty read (rule 3.3).
const e = env as unknown as Env;
const rows = async (sql: string) => (await e.DB.prepare(sql).all<Record<string, string>>()).results;

beforeAll(() => applyMigrations(e.DB), 60_000);

// Imported inside each test, from a fresh module registry, so the values the test reads are the ones
// the source file holds at that moment (and a mutation run sees a changed value).
async function defaults() {
  vi.resetModules();
  return import("~/lib/content-defaults");
}

describe("the in-code content defaults", () => {
  it("match the settings the migrations seed, key for key and value for value", async () => {
    const seeded = Object.fromEntries(
      (await rows("SELECT key, value FROM settings")).map((r) => [r.key, r.value]),
    );
    expect(Object.keys(seeded).length).toBeGreaterThan(10);
    const { SETTING_DEFAULTS } = await defaults();
    expect(Object.keys(SETTING_DEFAULTS).sort()).toEqual(Object.keys(seeded).sort());
    expect(SETTING_DEFAULTS).toEqual(seeded);
  });

  it("match the pages the migrations seed, with their titles", async () => {
    const seeded = Object.fromEntries(
      (await rows("SELECT key, title, value FROM content_blocks WHERE kind = 'page'")).map((r) => [
        r.key,
        { title: r.title, value: r.value },
      ]),
    );
    expect(Object.keys(seeded).length).toBeGreaterThan(0);
    const { PAGE_DEFAULTS } = await defaults();
    expect(Object.keys(PAGE_DEFAULTS).sort()).toEqual(Object.keys(seeded).sort());
    expect(PAGE_DEFAULTS).toEqual(seeded);
  });

  it("keeps every seeded page published and every key in its kind's namespace", async () => {
    for (const r of await rows("SELECT key, kind, status FROM content_blocks")) {
      expect(r.key.startsWith(`${r.kind}:`), r.key).toBe(true);
      if (r.kind === "page") expect(r.status, r.key).toBe("published");
    }
  });
});
