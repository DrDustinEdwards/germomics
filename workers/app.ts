import { createRequestHandler, RouterContextProvider } from "react-router";
import { cloudflareContext } from "../app/lib/context.server";
import {
  enforceRateLimit,
  withSecurityHeaders,
} from "../app/lib/security.server";
import { captureException } from "../app/lib/sentry.server";

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
      // Abuse mitigation before any work: rate-limit auth/admin/AI paths (KV sliding window).
      const limited = await enforceRateLimit(env, request);
      if (limited) return withSecurityHeaders(limited, origin);

      const context = new RouterContextProvider();
      context.set(cloudflareContext, { env, ctx });
      const response = await requestHandler(request, context);
      // Security-header layer over every response (pages, feeds, resource routes, redirects).
      return withSecurityHeaders(response, origin);
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
} satisfies ExportedHandler<Env>;
