import { describe, expect, it } from "vitest";
import { FRESH_SECONDS, SWR_SECONDS, serveWithEdgeCache } from "~/lib/edge-cache.server";

// The edge cache sits in front of a signed-in admin, so what it refuses to store matters more than
// what it stores: an admin's request, a non-GET, a gated path or a personalised response must never
// be served to anyone else. Each test uses its own URL, since caches.default is shared in the file.
const ORIGIN = "https://germomics.com";
const cache = () => (caches as unknown as { default: Cache }).default;
let n = 0;
const fresh = (path = "/page") => `${ORIGIN}${path}${path.includes("?") ? "&" : "?"}t=${++n}`;

function harness() {
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException() {} } as unknown as ExecutionContext;
  let renders = 0;
  return {
    get renders() {
      return renders;
    },
    settle: () => Promise.all(pending),
    serve: (request: Request, make: () => Response = () => new Response(`render ${renders}`, { headers: { "Content-Type": "text/html" } })) =>
      serveWithEdgeCache({ request, ctx, render: async () => { const r = make(); renders++; return r; } }),
  };
}

async function storedAgo(url: string, seconds: number, body = "old") {
  await cache().put(
    new Request(url),
    new Response(body, { headers: { "Cache-Control": `public, max-age=${SWR_SECONDS}`, "x-cache-stored-at": String(Date.now() - seconds * 1000) } }),
  );
}

describe("serveWithEdgeCache", () => {
  it("renders a miss live, stores it, then serves the stored copy as a hit", async () => {
    const h = harness();
    const url = fresh();
    const first = await h.serve(new Request(url));
    expect(first.headers.get("x-cache")).toBe("MISS");
    expect(first.headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate");
    expect(first.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await first.text()).toBe("render 0");
    await h.settle();
    const second = await h.serve(new Request(url));
    expect(second.headers.get("x-cache")).toBe("HIT");
    expect(await second.text()).toBe("render 0");
    expect(h.renders).toBe(1);
    // Storage bookkeeping never reaches the client, and neither does the long edge TTL.
    expect(second.headers.has("x-cache-stored-at")).toBe(false);
    expect(second.headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate");
  });

  it("keeps a route's own Cache-Control across the round trip", async () => {
    const h = harness();
    const url = fresh("/feed/podcast/");
    const make = () => new Response("<rss/>", { headers: { "Cache-Control": "public, max-age=300" } });
    expect((await h.serve(new Request(url), make)).headers.get("Cache-Control")).toBe("public, max-age=300");
    await h.settle();
    const hit = await h.serve(new Request(url), make);
    expect(hit.headers.get("x-cache")).toBe("HIT");
    expect(hit.headers.get("Cache-Control")).toBe("public, max-age=300");
    expect(hit.headers.has("x-edge-orig-cc")).toBe(false);
  });

  it("bypasses the cache for a signed-in admin, a write, and every gated path", async () => {
    for (const request of [
      new Request(fresh(), { headers: { Cookie: "theme=dark; CF_Authorization=abc" } }),
      new Request(fresh(), { headers: { Cookie: "CF_Authorization=abc" } }),
      new Request(fresh(), { method: "POST", body: "x" }),
      new Request(`${ORIGIN}/health`),
      new Request(fresh("/admin/posts")),
      new Request(fresh("/api/carrel/v1/meta")),
      new Request(fresh("/search?q=cholera")),
      new Request(fresh("/preview/1/abc")),
      new Request(fresh("/unsubscribe?token=x")),
      new Request(fresh("/games/assets/sprite.png")),
    ]) {
      const h = harness();
      const res = await h.serve(request);
      expect(res.headers.get("x-cache"), request.url).toBe("BYPASS");
      await h.settle();
      expect(await cache().match(new Request(request.url)), request.url).toBeUndefined();
    }
  });

  it("caches a visitor whose cookies merely mention the name", async () => {
    const h = harness();
    const res = await h.serve(new Request(fresh(), { headers: { Cookie: "NOT_CF_Authorization=1" } }));
    expect(res.headers.get("x-cache")).toBe("MISS");
  });

  it("never stores an error, a cookie-setting response, or one marked private or no-store", async () => {
    for (const make of [
      () => new Response("missing", { status: 404 }),
      () => new Response("ok", { headers: { "Set-Cookie": "a=b" } }),
      () => new Response("ok", { headers: { "Cache-Control": "Private, max-age=60" } }),
      () => new Response("ok", { headers: { "Cache-Control": "no-store" } }),
    ]) {
      const h = harness();
      const url = fresh();
      const res = await h.serve(new Request(url), make);
      expect(res.headers.get("x-cache")).toBe("BYPASS");
      await h.settle();
      expect(await cache().match(new Request(url))).toBeUndefined();
    }
  });

  it("serves a stale entry at once and refreshes it in the background", async () => {
    const h = harness();
    const url = fresh();
    await storedAgo(url, FRESH_SECONDS + 1);
    const stale = await h.serve(new Request(url));
    expect(stale.headers.get("x-cache")).toBe("STALE");
    expect(await stale.text()).toBe("old");
    await h.settle();
    expect(h.renders).toBe(1);
    const next = await h.serve(new Request(url));
    expect(next.headers.get("x-cache")).toBe("HIT");
    expect(await next.text()).toBe("render 0");
  });

  it("does not refresh a stale entry with a response it may not store", async () => {
    const h = harness();
    const url = fresh();
    await storedAgo(url, FRESH_SECONDS + 1);
    await h.serve(new Request(url), () => new Response("err", { status: 500 }));
    await h.settle();
    expect(await (await cache().match(new Request(url)))!.text()).toBe("old");
  });

  it("serves an entry just inside the fresh window as a hit, and renders live past the stale window", async () => {
    const h = harness();
    const young = fresh();
    await storedAgo(young, FRESH_SECONDS - 2);
    expect((await h.serve(new Request(young))).headers.get("x-cache")).toBe("HIT");
    const old = fresh();
    await storedAgo(old, SWR_SECONDS + 1);
    const res = await h.serve(new Request(old));
    expect(res.headers.get("x-cache")).toBe("MISS");
    expect(await res.text()).toBe("render 0");
  });

  it("renders live when a cached entry has no timestamp", async () => {
    const h = harness();
    const url = fresh();
    await cache().put(new Request(url), new Response("untimed", { headers: { "Cache-Control": "public, max-age=600" } }));
    expect((await h.serve(new Request(url))).headers.get("x-cache")).toBe("MISS");
  });

  it("answers HEAD from the cache with no body, and never stores a HEAD render", async () => {
    const h = harness();
    const url = fresh();
    const miss = await h.serve(new Request(url, { method: "HEAD" }));
    expect(miss.headers.get("x-cache")).toBe("BYPASS");
    await h.settle();
    expect(await cache().match(new Request(url))).toBeUndefined();
    await h.serve(new Request(url));
    await h.settle();
    const head = await h.serve(new Request(url, { method: "HEAD" }));
    expect(head.headers.get("x-cache")).toBe("HIT");
    expect(head.body).toBeNull();
  });

  it("ignores tracking parameters and parameter order in the cache key", async () => {
    const h = harness();
    const base = fresh("/page?b=2&a=1");
    await h.serve(new Request(base));
    await h.settle();
    const u = new URL(base);
    const t = u.searchParams.get("t");
    const tracked = `${ORIGIN}/page?UTM_source=x&t=${t}&gclid=1&a=1&fbclid=2&b=2&utm_medium=y`;
    const res = await h.serve(new Request(tracked));
    expect(res.headers.get("x-cache")).toBe("HIT");
    const other = await h.serve(new Request(`${ORIGIN}/page?a=1&b=3&t=${t}`));
    expect(other.headers.get("x-cache")).toBe("MISS");
  });
});
