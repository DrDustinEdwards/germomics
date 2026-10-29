import { createRequestHandler, RouterContextProvider } from "react-router";
import { cloudflareContext } from "../app/lib/context.server";
import { enforceRateLimit } from "../app/lib/security.server";
import { CSP_REPORT_PATH, handleCspReport, withSecurityHeaders } from "../app/lib/security-headers";
import { serveWithEdgeCache } from "../app/lib/edge-cache.server";
import { carrelApi } from "../app/lib/carrel/handler.server";
import { runBackup } from "../app/lib/backup.server";

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

export default {
  async fetch(request, env, ctx) {
    const origin = new URL(request.url).origin;
    try {
      // Carrel's site API. Its own guard (prefix, rate limit, key, route) runs first and answers
      // everything under /api/carrel/v1; nothing else is served by it.
      const carrel = carrelApi(env);
      if (carrel.matches(request)) return withSecurityHeaders(await carrel.handle(request, ctx), origin);

      // CSP violation reports, logged to Workers Logs (security-headers.ts).
      if (new URL(request.url).pathname === CSP_REPORT_PATH) {
        return withSecurityHeaders(await handleCspReport(request, env), origin);
      }

      // Abuse mitigation before any work: rate-limit admin/AI/signup paths.
      const limited = await enforceRateLimit(env, request);
      if (limited) return withSecurityHeaders(limited, origin);

      // Render closure: a fresh RR context per call, since the edge-cache layer may re-render in
      // the background to refresh a stale entry. The cache layer applies the security headers (so
      // both live and cached responses carry them) and serves public anonymous GETs from
      // caches.default with stale-while-revalidate; authenticated/admin/api/mutating requests
      // bypass it and stay live.
      const render = () => {
        const context = new RouterContextProvider();
        context.set(cloudflareContext, { env, ctx });
        return requestHandler(request, context);
      };
      // Skip the edge cache during `npm run dev` so local edits are always live; the SWR cache is
      // a production concern and would only make local iteration serve stale anonymous HTML.
      if (import.meta.env.DEV) return withSecurityHeaders(await render(), origin);
      return await serveWithEdgeCache({ request, ctx, origin, render });
    } catch (err) {
      // Prod error hygiene: never leak a stack trace or internal detail to the client. The error
      // goes to Workers Logs.
      console.error("Unhandled worker error:", err);
      return withSecurityHeaders(
        new Response("Internal Server Error", {
          status: 500,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }),
        origin,
      );
    }
  },

  // Two crons (wrangler.jsonc triggers.crons). Every minute: the updates Carrel scheduled on live
  // articles go live (site-api's runSchedules; each one that fails is logged and tried again next
  // minute). Nightly: the D1 backup. Its errors are logged and rethrown, never swallowed: a failed
  // run must show as a failed invocation and age /health's backup reading. Awaited rather than
  // handed to waitUntil, whose rejection is only logged while the invocation still counts as a
  // success (Grok audit 2026-10-21, GE-11).
  async scheduled(controller, env) {
    if (controller.cron === SCHEDULES_CRON) {
      await carrelApi(env).runSchedules({ now: new Date(controller.scheduledTime) });
      return;
    }
    try {
      await runBackup(env);
    } catch (err) {
      console.error("Nightly backup failed:", err);
      throw err;
    }
  },
} satisfies ExportedHandler<Env>;
