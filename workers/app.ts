import { createRequestHandler, RouterContextProvider } from "react-router";
import { generateNonce } from "@dustinedwards/site-runtime/csp";
import { cloudflareContext, cspNonceContext } from "../app/lib/context.server";
import { enforceRateLimit } from "../app/lib/security.server";
import { CSP_REPORT_PATH, handleCspReport, withSecurityHeaders } from "../app/lib/security-headers";
import { serveWithEdgeCache } from "../app/lib/edge-cache.server";
import { carrelApi } from "../app/lib/carrel/handler.server";
import { runBackup } from "../app/lib/backup.server";
import { rerenderStale } from "../app/lib/render.server";
import { continueMediaBackfill } from "../app/lib/media/backfill.server";
import { PRELOADS } from "../app/lib/preloads";

// site-runtime's limiter class, bound as RATE_LIMITER (wrangler.jsonc); enforceRateLimit and the
// score submit count through it.
export { RateLimiter } from "@dustinedwards/site-runtime/rate-limit/durable-object";

// The one-minute cron in wrangler.jsonc; any other cron is the nightly backup.
const SCHEDULES_CRON = "* * * * *";

// Seed React Router v8's request context with the native Cloudflare bindings, so every
// loader/action/middleware reaches D1/R2/KV through `context` and never over HTTP or a
// Node API. Read them with getEnv(context) from context.server.
const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

// The preloads root.tsx links, on every rendered HTML page as the `Link` header Cloudflare Early Hints
// reads. In the render, so a cached entry carries it too. Appended, so a route's own Link stays.
function withPreloads(response: Response): Response {
  if (!(response.headers.get("Content-Type") ?? "").startsWith("text/html")) return response;
  const headers = new Headers(response.headers);
  headers.append("Link", PRELOADS.header);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request, env, ctx) {
    try {
      // Carrel's site API. Its own guard (prefix, rate limit, key, route) runs first and answers
      // everything under /api/carrel/v1; nothing else is served by it.
      const carrel = carrelApi(env);
      if (carrel.matches(request)) return withSecurityHeaders(await carrel.handle(request, ctx), request.url);

      // CSP violation reports, logged to Workers Logs (security-headers.ts).
      if (new URL(request.url).pathname === CSP_REPORT_PATH) {
        return withSecurityHeaders(await handleCspReport(request, env), request.url);
      }

      // Abuse mitigation before any work: rate-limit admin/AI/signup paths.
      const limited = await enforceRateLimit(env, request);
      if (limited) return withSecurityHeaders(limited, request.url);

      // Render closure: a fresh RR context and CSP nonce per call, since the edge-cache layer may
      // re-render in the background to refresh a stale entry. The render carries the security
      // headers, so a stored copy has them too; the cache layer serves public anonymous GETs from
      // caches.default with stale-while-revalidate, giving every reader a fresh nonce, while
      // authenticated/admin/api/mutating requests bypass it and stay live.
      const render = () => {
        const context = new RouterContextProvider();
        const nonce = generateNonce();
        context.set(cloudflareContext, { env, ctx });
        context.set(cspNonceContext, nonce);
        return requestHandler(request, context).then((page) => withSecurityHeaders(withPreloads(page), request.url, nonce));
      };
      // Skip the edge cache during `npm run dev` so local edits are always live; the SWR cache is
      // a production concern and would only make local iteration serve stale anonymous HTML.
      if (import.meta.env.DEV) return await render();
      return await serveWithEdgeCache({ request, ctx, render });
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
  // minute), then, until it has finished once, a batch of the media backfill. Nightly: the D1 backup, then the re-render of
  // stale bodies (app/lib/render.server.ts). The backup's errors are logged and rethrown, never swallowed: a failed
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
