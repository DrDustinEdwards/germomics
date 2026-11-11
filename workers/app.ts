// aislop-ignore-next-line ai-slop/hallucinated-import -- a Workers built-in, not an npm package
import { WorkerEntrypoint } from "cloudflare:workers";
import type { ServerBuild } from "react-router";
import { siteApiStep } from "@dustinedwards/site-api";
import { d1SiteApiStore, tombstoned } from "@dustinedwards/site-api/store";
import { standardFiles } from "@drdustinedwards/site-helpers/files";
import { markdownCopies } from "@drdustinedwards/site-helpers/markdown-copy";
import { PAGES_CACHE_TAG } from "@dustinedwards/site-runtime/edge-cache";
import { defineSite, siteRenderer, siteWorker } from "@dustinedwards/site-runtime/worker";
import { carrelApi } from "../app/lib/carrel/handler.server";
import { loadPage } from "../app/lib/content.server";
import { cronJobs } from "../app/lib/cron.server";
import { gameCacheTag } from "../app/lib/games.server";
import { setPageRenderer } from "../app/lib/page-dates.server";
import { nextPublishAt } from "../app/lib/posts.server";
import { FONT_PRELOADS } from "../app/lib/preloads";
import { enforceRateLimit } from "../app/lib/security.server";
import { security } from "../app/lib/security-headers";
import { getShowConfig } from "../app/lib/show.server";
import { INDEXNOW_KEY, NO_PREFETCH, ROBOTS_DISALLOW, SITE_ORIGIN } from "../app/lib/site";

export { RateLimiter } from "@dustinedwards/site-runtime/rate-limit/durable-object";

// Paths always rendered live, never stored: /search is query-driven and low-repeat, /unsubscribe and
// /subscribe/confirm render a per-token email, /games/assets are immutable R2 binaries that cache on their own, and
// /media keeps each resized image in the cache itself. (/admin and /api write or are signed in; a cookie, such as
// Access's CF_Authorization once the admin has signed in, already means a live render.)
const LIVE = [
  "/admin",
  "/api",
  "/search",
  "/unsubscribe",
  "/subscribe/confirm",
  "/games/assets/",
  "/media/",
];

// The paths with no Markdown copy: the admin, the APIs, the search, a game's canvas page and the other non-reading paths.
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

/** A game page's slug, for the tag its leaderboard's page is stored under. */
const gameSlug = (pathname: string) => /^\/games\/([^/.]+)/.exec(pathname)?.[1];

/**
 * The site's Worker: site-runtime's gateway, Renderer, request log and cron (./worker), with what is this site's own:
 * the bare host and the podcast feed's slash, its machine files, the rate limits, Carrel's site API, the pages stored by
 * default (a game's under its own tag too), Carrel's tombstones and the admin idle sign-out.
 */
const site = defineSite<Env>({
  name: "Germomics",
  serverBuild: () => import("virtual:react-router/server-build") as Promise<ServerBuild>,
  mode: import.meta.env.MODE,
  withSecurityHeaders: security.withSecurityHeaders,
  // https, the bare host, no trailing slash; the podcast feed keeps its slash (CLAUDE.md rule 1).
  canonical: { host: "germomics.com", except: ["/feed/podcast/"] },
  // robots.txt, ai.txt (named from the show and its policy page in D1), site.webmanifest and the IndexNow key file.
  files: (request, env) =>
    standardFiles({
      origin: SITE_ORIGIN,
      disallow: ROBOTS_DISALLOW,
      indexNowKey: INDEXNOW_KEY,
      ai: async () => {
        const [show, policy] = await Promise.all([
          getShowConfig(env),
          loadPage(env, "page:ai-txt"),
        ]);
        return {
          name: show.title,
          contact: show.ownerEmail,
          ...(policy.value ? { policy: policy.value.split("\n") } : {}),
        };
      },
      manifest: {
        name: "Germomics",
        description: "A podcast and writing project about microbiology and history.",
        themeColor: "#4F2D7F",
        backgroundColor: "#FBFAFD",
      },
    })(request),
  // Never the paths in NO_PREFETCH, nor a game, whose page is heavy (Phaser) and holds a leaderboard.
  speculationExclude: [...NO_PREFETCH, "/games/"],
  steps: [
    // Abuse mitigation before any work: the admin, AI and signup paths' rate limits.
    (request, env) => enforceRateLimit(env, request),
    // Carrel's site API under /api/carrel/v1 and its preview links (site-api's step); an accepted write purges.
    siteApiStep((env, kit) => carrelApi(env, () => kit.stylesheets())),
  ],
  cacheable: (_request, url) => !LIVE.some((prefix) => url.pathname.startsWith(prefix)),
  // No route names a Cache-Control of its own, so a 200 is stored a day under the pages tag (a game's also under its
  // own, so a score purges only that page), and fresh no later than the next scheduled post, which goes live on read
  // with no write to purge on (posts.server publiclyVisible).
  publicPages: async (url, env) => {
    const slug = gameSlug(url.pathname);
    return {
      tags: slug ? [PAGES_CACHE_TAG, gameCacheTag(slug)] : [PAGES_CACHE_TAG],
      until: await nextPublishAt(env).catch(() => null),
    };
  },
  preloads: FONT_PRELOADS,
  // A path Carrel removed answers 410 (site-api's tombstones).
  onNotFound: (response, request, env) =>
    tombstoned(response, new URL(request.url).pathname, d1SiteApiStore(env.DB)),
  // Prelum's markdownCopies: each public page has a Markdown copy at its path plus .md and answers Accept:
  // text/markdown. /llms-full.txt stays the site's own (llmsFull: false): it prints the show notes and essays and leaves
  // the transcripts out, which the generated one, built from whole pages, would print.
  wrap: (handler) =>
    markdownCopies(handler, {
      origin: SITE_ORIGIN,
      llmsFull: false,
      siteMarkdown: false,
      skip: (path) =>
        NO_COPY.some((prefix) => path === prefix.replace(/\/$/, "") || path.startsWith(prefix)),
    }),
  // An admin idle for an hour is signed out of Access (site-runtime ./access).
  adminIdle: [{ secret: (env) => env.ADMIN_IDLE_SECRET }],
  cron: cronJobs,
});

// The daily page-dates job reads each hub and static page as the Renderer would render it (app/lib/page-dates.server.ts).
setPageRenderer(async (path, env) => {
  const noContext = {
    waitUntil() {},
    passThroughOnException() {},
    props: {},
  } as unknown as ExecutionContext;
  const response = await site.render(new Request(`${SITE_ORIGIN}${path}`), env, noContext);
  const html = (response.headers.get("Content-Type") ?? "").includes("text/html");
  return response.ok && html ? response.text() : null;
});

export class Renderer extends siteRenderer(WorkerEntrypoint<Env>, site) {}

export default siteWorker(site) satisfies ExportedHandler<Env>;
