import { createRequestHandler, RouterContextProvider } from "react-router";
import { cloudflareContext } from "../app/lib/context.server";
import {
  enforceRateLimit,
  withSecurityHeaders,
} from "../app/lib/security.server";
import { serveWithEdgeCache } from "../app/lib/edge-cache.server";
import { captureException } from "../app/lib/sentry.server";
import { carrelApi } from "../app/lib/carrel/handler.server";
import { runBackup } from "../app/lib/backup.server";

// Seed React Router v8's request context with the native Cloudflare bindings, so every
// loader/action/middleware reaches D1/R2/KV through `context` and never over HTTP or a
// Node API (CLAUDE.md hard rule #1). Read them with getEnv(context) from context.server.
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
      if (carrel.matches(request)) return withSecurityHeaders(await carrel.handle(request), origin);

      // Abuse mitigation before any work: rate-limit auth/admin/AI paths (KV sliding window).
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
      // Prod error hygiene: never leak a stack trace or internal detail to the client. Report to
      // Sentry (best-effort, server-side only) when SENTRY_DSN is set.
      console.error("Unhandled worker error:", err);
      captureException(env, err, request, ctx);
      return withSecurityHeaders(
        new Response("Internal Server Error", {
          status: 500,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        }),
        origin,
      );
    }
  },

  // Nightly D1 backup (wrangler.jsonc triggers.crons). Errors are logged and rethrown, never
  // swallowed: a failed run must show as a failed invocation and age /health's backup reading.
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(
      runBackup(env).catch((err: unknown) => {
        console.error("Nightly backup failed:", err);
        throw err;
      }),
    );
  },
} satisfies ExportedHandler<Env>;
