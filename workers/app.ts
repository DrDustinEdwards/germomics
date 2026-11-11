import { isSiteApiRequest } from "@dustinedwards/site-api";
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
import {
  SPECULATION_RULES_HEADER,
  SPECULATION_RULES_PATH,
  speculationRulesResponse,
} from "@dustinedwards/site-runtime/prefetch";
import { canonicalRedirect } from "@dustinedwards/site-runtime/url";
import { runJobs } from "@dustinedwards/site-runtime/cron";
import { markdownCopies } from "@drdustinedwards/site-helpers/markdown-copy";
import { maintenanceOn, maintenanceResponse } from "@dustinedwards/site-runtime/maintenance";
import {
  logEvent,
  requestFields,
  routeNamer,
  withRequestLog,
} from "@dustinedwards/site-runtime/log";
import { countNotFound } from "@dustinedwards/site-runtime/not-found";
import { cloudflareContext, cspNonceContext } from "../app/lib/context.server";
import { enforceRateLimit } from "../app/lib/security.server";
import { CSP_REPORT_PATH, handleCspReport, security } from "../app/lib/security-headers";
import { carrelApi } from "../app/lib/carrel/handler.server";
import { d1SiteApiStore, tombstoned } from "@dustinedwards/site-api/store";
import { cronJobs } from "../app/lib/cron.server";
import { setPageRenderer } from "../app/lib/page-dates.server";
import { nextPublishAt } from "../app/lib/posts.server";
import { FONT_PRELOADS } from "../app/lib/preloads";
import { NO_PREFETCH, SITE_ORIGIN } from "../app/lib/site";

// site-runtime's limiter class, bound as RATE_LIMITER (wrangler.jsonc); enforceRateLimit and the
// score submit count through it.
export { RateLimiter } from "@dustinedwards/site-runtime/rate-limit/durable-object";

// A preview link's token (Carrel's /preview/<token>), cut from a logged path.
const PREVIEW_TOKEN = /\/(preview)\/[^/?#\s'"]+/g;

// Seed React Router v8's request context with the native Cloudflare bindings, so every
// loader/action/middleware reaches D1/R2/KV through `context` and never over HTTP or a
// Node API. Read them with getEnv(context) from context.server.
const serverBuild = () => import("virtual:react-router/server-build") as Promise<ServerBuild>;
const requestHandler = createRequestHandler(serverBuild, import.meta.env.MODE);

// The route pattern each `request` log line names (`/blog/:slug`), from the React Router build's route table, made once
// per isolate (site-runtime ./log's routeNamer). Requests the Worker answers itself (/api, /health, /mcp, /media) carry
// the path alone. The build loads beside the request, so the first few lines in an isolate may go without a route.
let nameRoute: ((request: Request) => string | undefined) | undefined;
function routeName(request: Request): string | undefined {
  if (!nameRoute)
    void serverBuild().then(
      (build) => (nameRoute ??= routeNamer(build.routes)),
      () => undefined,
    );
  return /^\/(api|health|mcp|media)(\/|$)/.test(new URL(request.url).pathname)
    ? undefined
    : nameRoute?.(request);
}

// Each render gets its own CSP nonce (React, React Router and the theme script carry it) and leaves with the security
// headers. A stored page's nonce is renewed for every reader in the gateway (security-headers.ts, `renew`), so no two
// readers share one.
function render(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const context = new RouterContextProvider();
  const nonce = security.nonceFor(request);
  context.set(cloudflareContext, { env, ctx });
  context.set(cspNonceContext, nonce);
  return requestHandler(request, context).then((page) => {
    // A public page sends no React, so the next page starts loading on hover through the speculation rules this header
    // names (site-runtime ./prefetch), as React Router's prefetch did when every page hydrated.
    if (page.headers.get("Content-Type")?.startsWith("text/html"))
      page.headers.set(SPECULATION_RULES_HEADER.name, SPECULATION_RULES_HEADER.value);
    return security.withSecurityHeaders(page, request, nonce);
  });
}

// The daily page-dates job reads each hub and static page as the Renderer would render it (app/lib/page-dates.server.ts).
setPageRenderer(async (path, env) => {
  const noContext = {
    waitUntil() {},
    passThroughOnException() {},
    props: {},
  } as unknown as ExecutionContext;
  const response = await render(new Request(`${SITE_ORIGIN}${path}`), env, noContext);
  const html = (response.headers.get("Content-Type") ?? "").includes("text/html");
  return response.ok && html ? response.text() : null;
});

// Paths that are always rendered live in the gateway, never stored. /admin + /api are gated/mutating; /search is
// query-driven and low-repeat; /preview is Carrel's preview links, answered before the app; /unsubscribe and /subscribe/confirm render a per-token email; /health is an
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
    pathname.startsWith("/subscribe/confirm") ||
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

// Each 404 a GET gets from the app, counted per path and referring host (site-runtime ./not-found), stored page or
// live; never a preview link's, whose path carries its token.
function counted(response: Response, request: Request, env: Env, ctx: ExecutionContext): Response {
  if (!new URL(request.url).pathname.startsWith("/preview/"))
    countNotFound(env.DB, request, response, ctx);
  return response;
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
      const shared = publicPageHeaders({
        tags: tag ? [PAGES_CACHE_TAG, tag] : [PAGES_CACHE_TAG],
        until: await until,
      });
      for (const [name, value] of Object.entries(shared)) page.headers.set(name, value);
    }
    // Early Hints: the zone answers a page carrying a preload Link header with a 103 first, so the browser starts the
    // render-blocking stylesheet and the hero's font while the Worker still renders (site-runtime ./preload).
    const hints = withPreloadHeader(
      page,
      preloads([...rootStylesheets(await serverBuild()), ...FONT_PRELOADS]).header,
    );
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
    try {
      // One hop to the canonical address: https, the bare host, no trailing slash. The podcast feed keeps its slash
      // (CLAUDE.md rule 1).
      const redirect = canonicalRedirect(request, {
        host: "germomics.com",
        except: ["/feed/podcast/"],
      });
      if (redirect) return security.withSecurityHeaders(redirect, request);

      // The maintenance page (site-runtime ./maintenance): every path but /health answers 503 while the MAINTENANCE var is on.
      if (maintenanceOn(env) && url.pathname !== "/health")
        return security.withSecurityHeaders(
          maintenanceResponse({ siteName: "Germomics" }),
          request,
        );

      // Carrel's site API. Its own guard (prefix, rate limit, key, route) runs first and answers
      // everything under /api/carrel/v1; nothing else is served by it. An accepted write purges the stored pages.
      // Only its own requests load it; a preview reads the site's stylesheets when it draws.
      if (isSiteApiRequest(url)) {
        const carrel = carrelApi(env, async () =>
          rootStylesheets(await serverBuild()).map((s) => s.href),
        );
        if (carrel.matches(request)) {
          const response = await carrel.handle(request, ctx);
          purgeAfterWrite(request, response, ctx, `carrel ${request.method} ${url.pathname}`);
          return security.withSecurityHeaders(response, request);
        }
        // A preview link Carrel made (/preview/<token>, no key): the post's current source in the site's stylesheet,
        // noindex and never stored. The package's no-referrer stays, so the token, which is the address, is never sent on.
        if (carrel.matchesPreviewLink(request))
          return security.withSecurityHeaders(await carrel.servePreviewLink(request), request);
      }

      // The prefetch rules every page's Speculation-Rules header names (render above): never the paths in NO_PREFETCH
      // (beside the family's /admin, /api and the rest), nor a game, whose page is heavy (Phaser) and holds a leaderboard.
      if (url.pathname === SPECULATION_RULES_PATH) {
        return security.withSecurityHeaders(
          speculationRulesResponse({ exclude: [...NO_PREFETCH, "/games/"] }, request),
          request,
        );
      }

      // CSP violation reports, logged to Workers Logs (security-headers.ts).
      if (url.pathname === CSP_REPORT_PATH) {
        return security.withSecurityHeaders(await handleCspReport(request, env), request);
      }

      // Abuse mitigation before any work: rate-limit admin/AI/signup paths.
      const limited = await enforceRateLimit(env, request);
      if (limited) return security.withSecurityHeaders(limited, request);

      // Rendered live: writes, the signed-in admin, the live paths, and everything during `npm run dev`.
      const signedIn = hasSessionCookie(request);
      const read = request.method === "GET" || request.method === "HEAD";
      if (import.meta.env.DEV || !read || signedIn || livePath(url.pathname)) {
        const live = await render(request, env, ctx);
        // An admin save changes public pages; a score changes its game page only. Other public writes
        // (subscribe, unsubscribe) change none.
        if (url.pathname.startsWith("/admin"))
          purgeAfterWrite(request, live, ctx, `admin ${request.method} ${url.pathname}`);
        const tag = gameTag(url.pathname);
        if (tag && !read && live.status < 400)
          ctx.waitUntil(ctx.exports.Renderer.purgePages(`score ${url.pathname}`, [tag]));
        // A public page rendered for the admin is theirs alone; a response naming no Cache-Control would otherwise be
        // cached by the platform's heuristics.
        if (signedIn && !livePath(url.pathname))
          return counted(
            await tombstoned(privateRender(live), url.pathname, d1SiteApiStore(env.DB)),
            request,
            env,
            ctx,
          );
        if (!live.headers.has("Cache-Control")) live.headers.set("Cache-Control", UNCACHED);
        return counted(
          await tombstoned(live, url.pathname, d1SiteApiStore(env.DB)),
          request,
          env,
          ctx,
        );
      }

      // The key is the path and the query without tracking parameters. The Worker version stays in the key (no
      // `cross_version_cache`), so every deploy starts cold. A request with a cookie is told no-store for the browser; a
      // reader who already holds the page gets a 304. A HEAD reaches the Renderer as a GET, so its answer is a whole page
      // that may be stored; the reader still gets no body.
      const page = await ctx.exports.Renderer.fetch(forRenderer(request), {
        cf: { cacheKey: cacheKey(url) },
      });
      return counted(
        await tombstoned(
          forReader(security.withSecurityHeaders(page, request), request),
          url.pathname,
          d1SiteApiStore(env.DB),
        ),
        request,
        env,
        ctx,
      );
    } catch (error) {
      // Prod error hygiene: never leak a stack trace or internal detail to the client. The error
      // goes to Workers Logs.
      logEvent(
        "worker_error",
        { ...requestFields(request, { sha: env.DEPLOY_SHA, tokenPath: PREVIEW_TOKEN }), error },
        { level: "error", tokenPath: PREVIEW_TOKEN },
      );
      return security.withSecurityHeaders(
        new Response("Internal Server Error", {
          status: 500,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }),
        request,
      );
    }
  },

  // Two crons (wrangler.jsonc triggers.crons), each with its own job list (app/lib/cron.server.ts), each job isolated,
  // timed out and recorded in cron_runs by site-runtime ./cron, which /health reads; a failed job fails the invocation
  // after the others have run. Awaited rather than handed to waitUntil, whose rejection is only logged while the
  // invocation still counts as a success (Grok audit 2026-10-21, GE-11). A cron with no list (a trigger added in the
  // dashboard or a misspelt key) runs nothing and says so, and the jobs it was meant for warn "never ran" on /health.
  async scheduled(controller, env) {
    const jobs = cronJobs(env, new Date(controller.scheduledTime))[controller.cron];
    if (!jobs) {
      logEvent("cron_unknown", { cron: controller.cron }, { level: "warn" });
      return;
    }
    await runJobs(env.DB, jobs);
  },
} satisfies ExportedHandler<Env>;

// An admin idle for an hour is signed out of Access (site-runtime ./access). Every request writes one `request` line
// (site-runtime ./log: path, status, ms and the deployed commit), a preview link's token cut from its path.
type IncomingRequest = Parameters<typeof site.fetch>[0];
const answer = (request: Request, env: Env, ctx: ExecutionContext) =>
  withAdminIdle(request, () => site.fetch(request as IncomingRequest, env, ctx), {
    secret: env.ADMIN_IDLE_SECRET,
  });

// Prelum's markdownCopies: each public page has a Markdown copy at its path plus .md and answers Accept: text/markdown.
// /llms-full.txt stays the site's own (llmsFull: false): it prints the show notes and essays and leaves the transcripts
// out, which the generated one, built from whole pages, would print. The admin, the APIs, the search, a game's canvas
// page and the other non-reading paths get no copy.
const NO_COPY = [
  "/admin",
  "/api/",
  "/search",
  "/preview",
  "/health",
  "/unsubscribe",
  "/subscribe/confirm",
  "/games/",
  "/media/",
  "/feed/",
];
const withMarkdownCopies = markdownCopies(answer, {
  origin: SITE_ORIGIN,
  llmsFull: false,
  siteMarkdown: false,
  skip: (path) =>
    NO_COPY.some((prefix) => path === prefix.replace(/\/$/, "") || path.startsWith(prefix)),
});

export default {
  ...site,
  fetch: withRequestLog(withMarkdownCopies, {
    sha: (env) => env.DEPLOY_SHA,
    tokenPath: PREVIEW_TOKEN,
    route: routeName,
  }),
} satisfies ExportedHandler<Env>;
