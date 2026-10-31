// aislop-ignore-next-line ai-slop/hallucinated-import -- a Workers built-in, not an npm package
import { WorkerEntrypoint } from "cloudflare:workers";
import { createRequestHandler, RouterContextProvider, type ServerBuild } from "react-router";
import {
  PAGES_CACHE_TAG,
  UNCACHED,
  cacheKey,
  forReader,
  forRenderer,
  privateRender,
  publicPageHeaders,
  purgeAfterWrite,
  settleCacheHeaders,
  withPurgePages,
} from "@dustinedwards/site-runtime/edge-cache";
import { withAdminIdle } from "@dustinedwards/site-runtime/access";
import { preloads, rootStylesheets, withPreloadHeader } from "@dustinedwards/site-runtime/preload";
import { timedRender } from "@dustinedwards/site-runtime/server-timing";
import { generateNonce, renewNonce } from "@dustinedwards/site-runtime/csp";
import { canonicalRedirect } from "@dustinedwards/site-runtime/url";
import { cloudflareContext, cspNonceContext } from "../app/lib/context.server";
import { enforceRateLimit } from "../app/lib/security.server";
import { CSP_REPORT_PATH, handleCspReport, withSecurityHeaders } from "../app/lib/security-headers";
import { carrelApi } from "../app/lib/carrel/handler.server";
import { runBackup } from "../app/lib/backup.server";
import { rerenderStale } from "../app/lib/render.server";
import { continueMediaBackfill } from "../app/lib/media/backfill.server";
import { nextPublishAt } from "../app/lib/posts.server";
import { FONT_PRELOADS } from "../app/lib/preloads";

// site-runtime's limiter class, bound as RATE_LIMITER (wrangler.jsonc); enforceRateLimit and the
// score submit count through it.
export { RateLimiter } from "@dustinedwards/site-runtime/rate-limit/durable-object";

// The one-minute cron in wrangler.jsonc; any other cron is the nightly backup.
const SCHEDULES_CRON = "* * * * *";

// Seed React Router v8's request context with the native Cloudflare bindings, so every
// loader/action/middleware reaches D1/R2/KV through `context` and never over HTTP or a
// Node API. Read them with getEnv(context) from context.server.
const serverBuild = () => import("virtual:react-router/server-build") as Promise<ServerBuild>;
const requestHandler = createRequestHandler(serverBuild, import.meta.env.MODE);

// Each render gets its own CSP nonce (React, React Router and the theme script carry it) and leaves with the security
// headers. A stored page's nonce is renewed for every reader in the gateway (renewNonce), so no two readers share one.
function render(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const context = new RouterContextProvider();
  const nonce = generateNonce();
  context.set(cloudflareContext, { env, ctx });
  context.set(cspNonceContext, nonce);
  return requestHandler(request, context).then((page) => withSecurityHeaders(page, request.url, nonce));
}

// Paths that are always rendered live in the gateway, never stored. /admin + /api are gated/mutating; /search is
// query-driven and low-repeat; /preview shows tokenized drafts; /unsubscribe renders a per-token email; /health is an
// ops probe (no-store); /games/assets are immutable R2 binaries that already cache on their own, and /media keeps each
// resized image in the cache itself.
function livePath(pathname: string): boolean {
  return (
    pathname === "/health" ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/search") ||
    pathname.startsWith("/preview/") ||
    pathname.startsWith("/unsubscribe") ||
    pathname.startsWith("/games/assets/") ||
    pathname.startsWith("/media/")
  );
}

// Cloudflare Access sets a `CF_Authorization` cookie on the host once the admin has signed in. Such a request renders
// live, so the admin's ?preview shows drafts and is never stored. (Visitors never have one.)
function hasSessionCookie(request: Request): boolean {
  const cookie = request.headers.get("Cookie");
  return cookie ? /(?:^|;\s*)CF_Authorization=/.test(cookie) : false;
}

// A game page shows its leaderboard, so it carries its own tag too and a score purges only that page.
function gameTag(pathname: string): string | null {
  const slug = /^\/games\/([^/.]+)/.exec(pathname)?.[1];
  return slug ? `game-${slug}` : null;
}

/**
 * The cacheable entrypoint (wrangler.jsonc, `exports`): every public page and text route, rendered and then stored by
 * the Workers cache under the key the gateway names. Every header a stored page leaves with is set here, or it is
 * missing from every hit. No public page sets a cookie, so a stored page is the same for every reader but its nonce,
 * which the gateway renews.
 */
export class Renderer extends withPurgePages(WorkerEntrypoint<Env>) {
  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const until = nextPublishAt(this.env).catch(() => null);
    const page = await timedRender(() => render(request, this.env, this.ctx));
    // A 200 that names no Cache-Control of its own is public: stored a day, purged on every write, and fresh no later
    // than the next scheduled post, which goes live on read with no write to purge on (posts.server publiclyVisible).
    if (page.status === 200 && !page.headers.has("Cache-Control")) {
      const tag = gameTag(url.pathname);
      const shared = publicPageHeaders({ tags: tag ? [PAGES_CACHE_TAG, tag] : [PAGES_CACHE_TAG], until: await until });
      for (const [name, value] of Object.entries(shared)) page.headers.set(name, value);
    }
    // Early Hints: the zone answers a page carrying a preload Link header with a 103 first, so the browser starts the
    // render-blocking stylesheet and the hero's font while the Worker still renders (site-runtime ./preload).
    const hints = withPreloadHeader(page, preloads([...rootStylesheets(await serverBuild()), ...FONT_PRELOADS]).header);
    // Last: anything but a shared 200 (/health, a 404, an error) or one rendered for a cookie leaves private, no-store.
    return settleCacheHeaders(hints, request);
  }
}

/**
 * THE GATEWAY. Cache disabled, so it runs on every request: Carrel's API, the CSP report receiver, the rate limiter,
 * writes, the admin and the live paths answer here and are never stored; every other read is the Renderer's, through
 * the Workers cache.
 */
const site = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = url.origin;
    try {
      // One hop to the canonical address: https, the bare host, no trailing slash. The podcast feed keeps its slash
      // (CLAUDE.md rule 1).
      const redirect = canonicalRedirect(request, { host: "germomics.com", except: ["/feed/podcast/"] });
      if (redirect) return withSecurityHeaders(redirect, origin);

      // Carrel's site API. Its own guard (prefix, rate limit, key, route) runs first and answers
      // everything under /api/carrel/v1; nothing else is served by it. An accepted write purges the stored pages.
      const carrel = carrelApi(env);
      if (carrel.matches(request)) {
        const response = await carrel.handle(request, ctx);
        purgeAfterWrite(request, response, ctx, `carrel ${request.method} ${url.pathname}`);
        return withSecurityHeaders(response, origin);
      }

      // CSP violation reports, logged to Workers Logs (security-headers.ts).
      if (url.pathname === CSP_REPORT_PATH) {
        return withSecurityHeaders(await handleCspReport(request, env), origin);
      }

      // Abuse mitigation before any work: rate-limit admin/AI/signup paths.
      const limited = await enforceRateLimit(env, request);
      if (limited) return withSecurityHeaders(limited, request.url);

      // Rendered live: writes, the signed-in admin, the live paths, and everything during `npm run dev`.
      const signedIn = hasSessionCookie(request);
      const read = request.method === "GET" || request.method === "HEAD";
      if (import.meta.env.DEV || !read || signedIn || livePath(url.pathname)) {
        const live = await render(request, env, ctx);
        // An admin save changes public pages; a score changes its game page only. Other public writes
        // (subscribe, unsubscribe) change none.
        if (url.pathname.startsWith("/admin")) purgeAfterWrite(request, live, ctx, `admin ${request.method} ${url.pathname}`);
        const tag = gameTag(url.pathname);
        if (tag && !read && live.status < 400) ctx.waitUntil(ctx.exports.Renderer.purgePages(`score ${url.pathname}`, [tag]));
        // A public page rendered for the admin is theirs alone; a response naming no Cache-Control would otherwise be
        // cached by the platform's heuristics.
        if (signedIn && !livePath(url.pathname)) return privateRender(live);
        if (!live.headers.has("Cache-Control")) live.headers.set("Cache-Control", UNCACHED);
        return live;
      }

      // The key is the path and the query without tracking parameters. The Worker version stays in the key (no
      // `cross_version_cache`), so every deploy starts cold. A request with a cookie is told no-store for the browser; a
      // reader who already holds the page gets a 304. A HEAD reaches the Renderer as a GET, so its answer is a whole page
      // that may be stored; the reader still gets no body.
      const page = await ctx.exports.Renderer.fetch(forRenderer(request), { cf: { cacheKey: cacheKey(url) } });
      return forReader(renewNonce(page), request);
    } catch (err) {
      // Prod error hygiene: never leak a stack trace or internal detail to the client. The error
      // goes to Workers Logs.
      console.error("Unhandled worker error:", err);
      return withSecurityHeaders(
        new Response("Internal Server Error", {
          status: 500,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }),
        request.url,
      );
    }
  },

  // Two crons (wrangler.jsonc triggers.crons). Every minute: the updates Carrel scheduled on live
  // articles go live (site-api's runSchedules; each one that fails is logged and tried again next
  // minute; each that lands purges the stored pages, carrel/handler.server), then, until it has finished once, a batch of
  // the media backfill. Nightly: the D1 backup, then the re-render of stale bodies (app/lib/render.server.ts).
  // The backup's errors are logged and rethrown, never swallowed: a failed
  // run must show as a failed invocation and age /health's backup reading. Awaited rather than
  // handed to waitUntil, whose rejection is only logged while the invocation still counts as a
  // success (Grok audit 2026-10-21, GE-11).
  async scheduled(controller, env) {
    if (controller.cron === SCHEDULES_CRON) {
      await carrelApi(env).runSchedules({ now: new Date(controller.scheduledTime) });
      await continueMediaBackfill(env);
      return;
    }
    try {
      await runBackup(env);
    } catch (err) {
      console.error("Nightly backup failed:", err);
      throw err;
    }
    // After the backup: the rows a Prelum upgrade left on an older render are rendered again and stored.
    console.log(JSON.stringify({ event: "render.stale", ...(await rerenderStale(env)) }));
  },
} satisfies ExportedHandler<Env>;

// An admin idle for an hour is signed out of Access (site-runtime ./access).
export default {
  ...site,
  fetch: (request, env, ctx) => withAdminIdle(request, () => site.fetch(request, env, ctx)),
} satisfies ExportedHandler<Env>;
