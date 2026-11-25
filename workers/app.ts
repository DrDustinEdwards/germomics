// aislop-ignore-next-line ai-slop/hallucinated-import -- a Workers built-in, not an npm package
import { WorkerEntrypoint } from "cloudflare:workers";
import type { ServerBuild } from "react-router";
import { siteApiStep } from "@dustinedwards/site-api";
import { d1SiteApiStore, tombstoned } from "@dustinedwards/site-api/store";
import { standardFiles } from "@drdustinedwards/site-helpers/files";
import { markdownCopies } from "@drdustinedwards/site-helpers/markdown-copy";
import { PAGES_CACHE_TAG } from "@dustinedwards/site-runtime/edge-cache";
import { logEvent } from "@dustinedwards/site-runtime/log";
import { renderHtml } from "@dustinedwards/site-runtime/render-html";
import { defineSite, siteRenderer, siteWorker } from "@dustinedwards/site-runtime/worker";
import { carrelApi } from "../app/lib/carrel/handler.server";
import { loadPage } from "../app/lib/content.server";
import { cronJobs } from "../app/lib/cron.server";
import { draftPageContext, previewPostContext } from "../app/lib/preview-context";
import { gameCacheTag } from "../app/lib/games.server";
import { setPageRenderer } from "@drdustinedwards/site-helpers/lastmod";
import { nextPublishAt } from "../app/lib/posts.server";
import { FONT_PRELOADS } from "../app/lib/preloads";
import { enforceRateLimit } from "../app/lib/security.server";
import { security } from "../app/lib/security-headers";
import { getShowConfig } from "../app/lib/show.server";
import { INDEXNOW_KEY, NO_PREFETCH, ROBOTS_DISALLOW, SITE_ORIGIN } from "../app/lib/site";

export { RateLimiter } from "@dustinedwards/site-runtime/rate-limit/durable-object";

// Paths always rendered live, never stored: /search is low-repeat, /unsubscribe and /subscribe/confirm render a
// per-token email, /games/assets and /media cache themselves. A cookie (Access's CF_Authorization) already means live.
const LIVE = [
  "/admin",
  "/api",
  "/search",
  "/unsubscribe",
  "/subscribe/confirm",
  "/games/assets/",
  "/media/",
];

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

/** A prefix matches a whole segment, so a post slug that merely starts with the word is not caught. */
const under = (path: string, prefixes: string[]) =>
  prefixes.some(
    (p) => path === p.replace(/\/$/, "") || path.startsWith(p.endsWith("/") ? p : `${p}/`),
  );

const gameSlug = (pathname: string) => /^\/games\/([^/.]+)/.exec(pathname)?.[1];

const site = defineSite<Env>({
  name: "Germomics",
  serverBuild: () => import("virtual:react-router/server-build") as Promise<ServerBuild>,
  mode: import.meta.env.MODE,
  withSecurityHeaders: security.withSecurityHeaders,
  // https, the bare host, no trailing slash; the podcast feed keeps its slash (CLAUDE.md, Podcast feed).
  canonical: { host: "germomics.com", except: ["/feed/podcast/"] },
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
  // Never NO_PREFETCH paths, nor a game: its page is heavy (Phaser) and holds a leaderboard.
  speculationExclude: [...NO_PREFETCH, "/games/"],
  steps: [
    (request, env) => enforceRateLimit(env, request),
    // A preview renders the draft through the page's own route in-process (kit.render), never stored; an accepted write purges.
    siteApiStep((env, kit) =>
      carrelApi(env, (request, draft) =>
        kit.render(request, {
          set: (context) =>
            "post" in draft
              ? context.set(previewPostContext, draft.post)
              : context.set(draftPageContext, draft.page),
        }),
      ),
    ),
  ],
  cacheable: (_request, url) => !under(url.pathname, LIVE),
  // A 200 is stored a day under the pages tag (a game's also under its own, so a score purges only that page), and no
  // later than the next scheduled post, which goes live on read with no write to purge on (publiclyVisible).
  publicPages: async (url, env) => {
    const slug = gameSlug(url.pathname);
    return {
      tags: slug ? [PAGES_CACHE_TAG, gameCacheTag(slug)] : [PAGES_CACHE_TAG],
      // A database error is logged and the page is served with the default lifetime, not failed.
      until: await nextPublishAt(env).catch((error) => {
        logEvent("next_publish_failed", { error }, { level: "error" });
        return null;
      }),
    };
  },
  preloads: FONT_PRELOADS,
  // Every public page renders inside routes/_site, whose stylesheet (site.css) joins Early Hints and the Carrel preview's.
  stylesheetRoutes: ["routes/_site"],
  onNotFound: (response, request, env) =>
    tombstoned(response, new URL(request.url).pathname, d1SiteApiStore(env.DB)),
  // Markdown copies at path + .md and on Accept: text/markdown. /llms-full.txt stays the site's own (llmsFull: false):
  // the generated one would print the transcripts.
  wrap: (handler) =>
    markdownCopies(handler, {
      origin: SITE_ORIGIN,
      llmsFull: false,
      siteMarkdown: false,
      skip: (path) => under(path, NO_COPY),
    }),
  adminIdle: [{ secret: (env) => env.ADMIN_IDLE_SECRET }],
  cron: cronJobs,
});

setPageRenderer((path, env) => renderHtml(site, new Request(`${SITE_ORIGIN}${path}`), env));

export class Renderer extends siteRenderer(WorkerEntrypoint<Env>, site) {}

export default siteWorker(site) satisfies ExportedHandler<Env>;
