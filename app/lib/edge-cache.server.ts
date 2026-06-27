// app/lib/edge-cache.server.ts — server-only edge cache for public, anonymous SSR HTML.
//
// Wraps the Worker fetch path so public GET responses are served from Cloudflare's per-colo cache
// (caches.default) with stale-while-revalidate. This sits in FRONT of an authenticated app, so the
// bypass rules are the load-bearing part: a personalized, session-dependent, or cookie-setting
// response must never be written to cache. Correctness over hit rate.
//
// The Cache API does not expose entry age, so freshness is tracked with our own x-cache-stored-at
// timestamp. No global purge exists (Cache API delete is per-colo): the short FRESH window is what
// makes an admin edit visible to anonymous visitors, and every signed-in/admin request is always
// live via the session-cookie bypass (which is also what gives the admin instant-edit visibility).

import { withSecurityHeaders } from "./security.server";

// Tunable windows. age < FRESH: serve cached as-is. FRESH..SWR: serve stale and refresh in the
// background. age >= SWR (or a miss): render live. Kept at the top so they are easy to tune.
export const FRESH_SECONDS = 60;
export const SWR_SECONDS = 86_400; // 1 day

const STORED_AT = "x-cache-stored-at"; // ms epoch we wrote the entry; drives the age computation
const ORIG_CC = "x-edge-orig-cc"; // stashes a route's own Cache-Control across the cache round-trip
const STATUS = "x-cache"; // HIT | STALE | MISS | BYPASS, for verification

// Client-facing Cache-Control for HTML that declared none of its own: revalidate on every
// navigation so a browser never serves our short-lived HTML past the edge's freshness window. The
// edge retention TTL (below) is separate and never leaks to the client.
const HTML_CLIENT_CC = "public, max-age=0, must-revalidate";

// Paths that must always be live. /admin + /api (incl. /api/auth) are gated/mutating; /search is
// query-driven and low-repeat; /preview shows tokenized drafts; /unsubscribe mutates on GET and
// renders a per-token email; /health is an ops probe (no-store); /games/assets are immutable R2
// binaries that already cache on their own.
function bypassPath(pathname: string): boolean {
  return (
    pathname === "/health" ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/search") ||
    pathname.startsWith("/preview/") ||
    pathname.startsWith("/unsubscribe") ||
    pathname.startsWith("/games/assets/")
  );
}

// Better Auth's session cookie is `better-auth.session_token`, prefixed with `__Secure-` over
// HTTPS (and a `better-auth.session_data` cookie when cookie-cache is on). Match the stable
// substring so every form is caught — any request carrying one is treated as authenticated.
function hasSessionCookie(request: Request): boolean {
  const cookie = request.headers.get("Cookie");
  return cookie ? /better-auth/i.test(cookie) : false;
}

// Tracking params never change the rendered page; strip them (and sort the rest) so they don't
// fragment the cache key. Only the cache KEY is normalized — the live render still uses the
// original request URL.
function cacheKey(url: URL): Request {
  const u = new URL(url.toString());
  const drop: string[] = [];
  u.searchParams.forEach((_v, k) => {
    const key = k.toLowerCase();
    if (key.startsWith("utm_") || key === "fbclid" || key === "gclid") drop.push(k);
  });
  for (const k of drop) u.searchParams.delete(k);
  u.searchParams.sort();
  return new Request(u.toString(), { method: "GET" });
}

// A rendered response may only be stored when it cannot possibly be personalized: a clean 200,
// no Set-Cookie, and not explicitly opted out via no-store/private.
function responseIsCacheable(response: Response): boolean {
  if (response.status !== 200) return false;
  if (response.headers.has("Set-Cookie")) return false;
  const cc = response.headers.get("Cache-Control")?.toLowerCase() ?? "";
  if (cc.includes("no-store") || cc.includes("private")) return false;
  return true;
}

function ageSeconds(cached: Response): number | null {
  const ms = Number(cached.headers.get(STORED_AT));
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, (Date.now() - ms) / 1000);
}

// Shape a freshly-rendered (already security-headered) response for the Cache API: stash the
// route's own Cache-Control, stamp it, and give it a uniform long edge-retention TTL. Our
// stored-at + FRESH/SWR logic governs freshness; this TTL only keeps the entry around.
function forStorage(secured: Response): Response {
  const headers = new Headers(secured.headers);
  const orig = headers.get("Cache-Control");
  if (orig) headers.set(ORIG_CC, orig);
  headers.set("Cache-Control", `public, max-age=${SWR_SECONDS}`);
  headers.set(STORED_AT, String(Date.now()));
  headers.delete(STATUS);
  return new Response(secured.body, {
    status: secured.status,
    statusText: secured.statusText,
    headers,
  });
}

// Serve an entry pulled from cache. Strip the storage bookkeeping, restore the client-facing
// Cache-Control (the route's own, or the HTML default — never the long retention TTL), and tag it.
function fromCache(cached: Response, status: "HIT" | "STALE", method: string): Response {
  const headers = new Headers(cached.headers);
  headers.delete(STORED_AT);
  const orig = headers.get(ORIG_CC);
  headers.delete(ORIG_CC);
  headers.set("Cache-Control", orig ?? HTML_CLIENT_CC);
  headers.set(STATUS, status);
  return new Response(method === "HEAD" ? null : cached.body, {
    status: cached.status,
    statusText: cached.statusText,
    headers,
  });
}

// Serve a live render (not from cache). MISS = rendered and stored; BYPASS = never cached.
function liveServed(secured: Response, status: "MISS" | "BYPASS"): Response {
  const headers = new Headers(secured.headers);
  if (status === "MISS" && !headers.has("Cache-Control")) headers.set("Cache-Control", HTML_CLIENT_CC);
  headers.set(STATUS, status);
  return new Response(secured.body, {
    status: secured.status,
    statusText: secured.statusText,
    headers,
  });
}

type RenderFn = () => Promise<Response>;

export async function serveWithEdgeCache(opts: {
  request: Request;
  ctx: ExecutionContext;
  origin: string;
  render: RenderFn;
}): Promise<Response> {
  const { request, ctx, origin, render } = opts;
  const url = new URL(request.url);
  const method = request.method;
  const readable = method === "GET" || method === "HEAD";

  // Bypass: any non-readable method, an authenticated request, or a non-public path goes straight
  // to a live render and never touches the cache.
  if (!readable || hasSessionCookie(request) || bypassPath(url.pathname)) {
    return liveServed(withSecurityHeaders(await render(), origin), "BYPASS");
  }

  // caches.default is the Cloudflare cache (worker-configuration.d.ts), but this app also pulls in
  // the DOM lib whose CacheStorage has no `default`; narrow the accessor so the global merge picks
  // the right one. Cache's match/put surface is identical across both type sets.
  const cache = (caches as unknown as { default: Cache }).default;
  const key = cacheKey(url);
  const cached = await cache.match(key);

  if (cached) {
    const age = ageSeconds(cached);
    if (age !== null && age < SWR_SECONDS) {
      if (age >= FRESH_SECONDS) {
        // Stale: serve immediately, refresh in the background.
        ctx.waitUntil(revalidate(cache, key, origin, render));
        return fromCache(cached, "STALE", method);
      }
      return fromCache(cached, "HIT", method);
    }
    // Missing timestamp or past SWR: fall through and render live.
  }

  // Miss / expired: render live, then store only a GET response that passes every invariant.
  const secured = withSecurityHeaders(await render(), origin);
  if (method === "GET" && responseIsCacheable(secured)) {
    ctx.waitUntil(cache.put(key, forStorage(secured.clone())));
    return liveServed(secured, "MISS");
  }
  return liveServed(secured, "BYPASS");
}

// Background refresh of a stale entry. Best-effort: a failed render just leaves the existing entry
// to age out and be re-rendered on a later request.
async function revalidate(cache: Cache, key: Request, origin: string, render: RenderFn): Promise<void> {
  try {
    const secured = withSecurityHeaders(await render(), origin);
    if (responseIsCacheable(secured)) await cache.put(key, forStorage(secured));
  } catch {
    /* keep the old entry */
  }
}
