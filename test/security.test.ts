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

const hit = (path: string, ip = "203.0.113.7") =>
  enforceRateLimit(e, new Request(`https://germomics.com${path}`, { headers: { "cf-connecting-ip": ip } }));

beforeEach(clearKv);

describe("enforceRateLimit", () => {
  beforeEach(() => e.APP_KV.put(SETTINGS, JSON.stringify({ "ratelimit.admin": "3", "ratelimit.ai": "2" })));

  it("lets public paths through without counting them", async () => {
    for (let i = 0; i < 5; i++) expect(await hit("/episodes/")).toBeNull();
    expect((await e.APP_KV.list({ prefix: "rl:" })).keys).toHaveLength(0);
  });

  it("allows the admin limit, then answers 429 in plain text", async () => {
    for (let i = 0; i < 3; i++) expect(await hit("/admin/posts")).toBeNull();
    const refused = await hit("/admin/posts");
    expect(refused?.status).toBe(429);
    expect(refused?.headers.get("Retry-After")).toBe("60");
    expect(refused?.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(await refused?.text()).toBe("Too many requests.");
  });

  it("gives the AI endpoint its own tighter bucket and a JSON refusal", async () => {
    expect(await hit("/admin/ai")).toBeNull();
    expect(await hit("/admin/ai/x")).toBeNull();
    const refused = await hit("/admin/ai");
    expect(refused?.status).toBe(429);
    expect(refused?.headers.get("Content-Type")).toBe("application/json; charset=utf-8");
    expect(await refused?.json()).toMatchObject({ ok: false });
    // The AI requests did not use up the admin bucket.
    expect(await hit("/admin/posts")).toBeNull();
  });

  it("counts each address separately, and requests with no address together", async () => {
    for (let i = 0; i < 3; i++) await hit("/admin", "198.51.100.1");
    expect((await hit("/admin", "198.51.100.1"))?.status).toBe(429);
    expect(await hit("/admin", "198.51.100.2")).toBeNull();

    const anon = () => enforceRateLimit(e, new Request("https://germomics.com/admin"));
    for (let i = 0; i < 3; i++) expect(await anon()).toBeNull();
    expect((await anon())?.status).toBe(429);
    expect(await e.APP_KV.get(`rl:admin:anon:${Math.floor(Date.now() / 60_000)}`)).toBe("3");
  });

  it("stores the count under this minute's window with a short expiry", async () => {
    await hit("/admin", "198.51.100.9");
    const window = Math.floor(Date.now() / 60_000);
    const { keys } = await e.APP_KV.list({ prefix: "rl:" });
    expect(keys.map((k) => k.name)).toEqual([`rl:admin:198.51.100.9:${window}`]);
    expect(keys[0].expiration! - Date.now() / 1000).toBeLessThanOrEqual(65);
    expect(keys[0].expiration! - Date.now() / 1000).toBeGreaterThan(60);
  });

  it("falls back to the default limit when the setting is missing or not a number", async () => {
    await e.APP_KV.put(SETTINGS, JSON.stringify({ "ratelimit.ai": "lots" }));
    for (let i = 0; i < 15; i++) expect(await hit("/admin/ai")).toBeNull();
    expect((await hit("/admin/ai"))?.status).toBe(429);
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
    expect(res.headers.get("Strict-Transport-Security")).toBe("max-age=31536000; includeSubDomains");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("Permissions-Policy")).toContain("camera=()");
    expect(res.headers.get("tdm-reservation")).toBe("1");
    expect(res.headers.get("tdm-policy")).toBe("https://germomics.com/ai.txt");
    expect(res.headers.get("Content-Security-Policy-Report-Only")).toContain("frame-ancestors 'none'");
  });

  it("never overwrites a header the route already set", () => {
    const res = withSecurityHeaders(
      new Response("x", { headers: { "X-Frame-Options": "SAMEORIGIN", "tdm-policy": "https://elsewhere.example/p" } }),
      "https://germomics.com",
    );
    expect(res.headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(res.headers.get("tdm-policy")).toBe("https://elsewhere.example/p");
  });

  it("adds no report-only policy when the route declared a policy of either kind", () => {
    const enforced = withSecurityHeaders(new Response("x", { headers: { "Content-Security-Policy": "default-src 'none'" } }), "https://g.test");
    expect(enforced.headers.get("Content-Security-Policy")).toBe("default-src 'none'");
    expect(enforced.headers.has("Content-Security-Policy-Report-Only")).toBe(false);
    const reportOnly = withSecurityHeaders(new Response("x", { headers: { "Content-Security-Policy-Report-Only": "img-src 'self'" } }), "https://g.test");
    expect(reportOnly.headers.get("Content-Security-Policy-Report-Only")).toBe("img-src 'self'");
  });
});
