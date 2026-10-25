import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { aiCostCapExceeded, enforceRateLimit, recordAiUse, withSecurityHeaders } from "~/lib/security.server";

// The in-Worker abuse layer in front of /admin and the AI endpoint, and the header layer every
// response passes through. Settings come from KV's cached map (content.server), seeded here so the
// limits are small and known.
const e = env as unknown as Env;
const SETTINGS = "cache:content:settings";

async function clearKv() {
  const { keys } = await e.APP_KV.list();
  await Promise.all(keys.map((k) => e.APP_KV.delete(k.name)));
}

const hit = (path: string, ip: string) =>
  enforceRateLimit(e, new Request(`https://germomics.com${path}`, { headers: { "cf-connecting-ip": ip } }));

beforeEach(clearKv);

// site-runtime tests the counting once; these pin germomics's own rules: which paths are metered,
// their buckets and the settings that size them. Each test uses its own addresses, since the
// limiter's Durable Object storage outlives a test.
describe("enforceRateLimit", () => {
  beforeEach(() => e.APP_KV.put(SETTINGS, JSON.stringify({ "ratelimit.admin": "3", "ratelimit.ai": "2" })));

  it("lets public paths through", async () => {
    for (let i = 0; i < 5; i++) expect(await hit("/episodes/", "203.0.113.1")).toBeNull();
  });

  it("allows the admin limit, then answers 429 in plain text", async () => {
    for (let i = 0; i < 3; i++) expect(await hit("/admin/posts", "203.0.113.2")).toBeNull();
    const refused = await hit("/admin/posts", "203.0.113.2");
    expect(refused?.status).toBe(429);
    expect(Number(refused?.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(refused?.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
  });

  it("gives the AI endpoint its own tighter bucket and a JSON refusal", async () => {
    expect(await hit("/admin/ai", "203.0.113.3")).toBeNull();
    expect(await hit("/admin/ai/x", "203.0.113.3")).toBeNull();
    const refused = await hit("/admin/ai", "203.0.113.3");
    expect(refused?.status).toBe(429);
    expect(refused?.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(await refused?.json()).toMatchObject({ ok: false });
    // The AI requests did not use up the admin bucket.
    expect(await hit("/admin/posts", "203.0.113.3")).toBeNull();
  });

  it("falls back to the default limit when the setting is missing or not a number", async () => {
    await e.APP_KV.put(SETTINGS, JSON.stringify({ "ratelimit.ai": "lots" }));
    for (let i = 0; i < 15; i++) expect(await hit("/admin/ai", "203.0.113.4")).toBeNull();
    expect((await hit("/admin/ai", "203.0.113.4"))?.status).toBe(429);
  });
});

describe("the AI daily cap", () => {
  const today = () => `ai:cap:${new Date().toISOString().slice(0, 10)}`;

  it("is not exceeded until the recorded uses reach the cap", async () => {
    await e.APP_KV.put(SETTINGS, JSON.stringify({ "ai.daily_cap": "2" }));
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
    await e.APP_KV.put(SETTINGS, JSON.stringify({}));
    await e.APP_KV.put(today(), "99");
    expect(await aiCostCapExceeded(e)).toBe(false);
    await e.APP_KV.put(today(), "100");
    expect(await aiCostCapExceeded(e)).toBe(true);
  });
});

describe("withSecurityHeaders", () => {
  it("adds the hardening headers and keeps the status and body", async () => {
    const res = withSecurityHeaders(new Response("hello", { status: 201, statusText: "Created" }), "https://germomics.com");
    expect(res.status).toBe(201);
    expect(res.statusText).toBe("Created");
    expect(await res.text()).toBe("hello");
    expect(res.headers.get("Strict-Transport-Security")).toContain("includeSubDomains");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("deny");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("Permissions-Policy")).toContain("camera=()");
    // The player, Copy link and the share sheet keep working.
    expect(res.headers.get("Permissions-Policy")).toContain("clipboard-write=(self)");
    expect(res.headers.get("tdm-reservation")).toBe("1");
    expect(res.headers.get("Content-Security-Policy-Report-Only")).toContain("frame-ancestors 'none'");
  });

  it("never overwrites a header the route already set", () => {
    const res = withSecurityHeaders(
      new Response("x", { headers: { "X-Frame-Options": "SAMEORIGIN" } }),
      "https://germomics.com",
    );
    expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
  });

  it("adds no report-only policy when the route declared a policy of either kind", () => {
    const enforced = withSecurityHeaders(new Response("x", { headers: { "Content-Security-Policy": "default-src 'none'" } }), "https://g.test");
    expect(enforced.headers.get("Content-Security-Policy")).toBe("default-src 'none'");
    expect(enforced.headers.has("Content-Security-Policy-Report-Only")).toBe(false);
    const reportOnly = withSecurityHeaders(new Response("x", { headers: { "Content-Security-Policy-Report-Only": "img-src 'self'" } }), "https://g.test");
    expect(reportOnly.headers.get("Content-Security-Policy-Report-Only")).toBe("img-src 'self'");
  });
});
