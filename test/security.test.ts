import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { aiCostCapExceeded, enforceRateLimit, recordAiUse } from "~/lib/security.server";
import { applyMigrations, setSettings } from "./helpers/d1";

// The in-Worker abuse layer in front of /admin and the media library's AI suggestions. Settings come from D1 (content.server), seeded here so the limits are
// small and known.
const e = env as unknown as Env;

async function clearKv() {
  const { keys } = await e.APP_KV.list();
  await Promise.all(keys.map((k) => e.APP_KV.delete(k.name)));
}

const hit = (path: string, ip: string) =>
  enforceRateLimit(e, new Request(`https://germomics.com${path}`, { headers: { "cf-connecting-ip": ip } }));

beforeAll(() => applyMigrations(e.DB));
beforeEach(clearKv);

// site-runtime tests the counting once; these pin germomics's own rules: which paths are metered,
// their buckets and the settings that size them. Each test uses its own addresses, since the
// limiter's Durable Object storage outlives a test.
describe("enforceRateLimit", () => {
  beforeEach(() => setSettings(e.DB, { "ratelimit.admin": "3" }));

  it("lets public paths through", async () => {
    for (let i = 0; i < 5; i++) expect(await hit("/episodes/", "203.0.113.1")).toBeNull();
  });

  it("allows the admin limit, then answers 429 in plain text", async () => {
    for (let i = 0; i < 3; i++) expect(await hit("/admin/episodes", "203.0.113.2")).toBeNull();
    const refused = await hit("/admin/episodes", "203.0.113.2");
    expect(refused?.status).toBe(429);
    expect(Number(refused?.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(refused?.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
  });
});

describe("the AI daily cap", () => {
  const today = () => `ai:cap:${new Date().toISOString().slice(0, 10)}`;

  it("is not exceeded until the recorded uses reach the cap", async () => {
    await setSettings(e.DB, { "ai.daily_cap": "2" });
    expect(await aiCostCapExceeded(e)).toBe(false);
    await recordAiUse(e);
    expect(await aiCostCapExceeded(e)).toBe(false);
    await recordAiUse(e);
    expect(await aiCostCapExceeded(e)).toBe(true);
    expect(await e.APP_KV.get(today())).toBe("2");
  });

  it("keeps the day's counter for about a day and a half", async () => {
    await recordAiUse(e);
    const { keys } = await e.APP_KV.list({ prefix: "ai:cap:" });
    expect(keys.map((k) => k.name)).toEqual([today()]);
    const ttl = keys[0].expiration! - Date.now() / 1000;
    expect(ttl).toBeGreaterThan(36 * 3600 - 60);
    expect(ttl).toBeLessThanOrEqual(36 * 3600);
  });

  it("uses the default cap of 100 when no setting is stored", async () => {
    await setSettings(e.DB, {});
    await e.APP_KV.put(today(), "99");
    expect(await aiCostCapExceeded(e)).toBe(false);
    await e.APP_KV.put(today(), "100");
    expect(await aiCostCapExceeded(e)).toBe(true);
  });
});
