import { createRequestHandler, RouterContextProvider } from "react-router";
import { cloudflareContext } from "../app/lib/context.server";

// Seed React Router v8's request context with the native Cloudflare bindings, so every
// loader/action/middleware reaches D1/R2/KV through `context` and never over HTTP or a
// Node API (CLAUDE.md hard rule #1). Read them with getEnv(context) from context.server.
const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE,
);

export default {
  async fetch(request, env, ctx) {
    const context = new RouterContextProvider();
    context.set(cloudflareContext, { env, ctx });
    return requestHandler(request, context);
  },
} satisfies ExportedHandler<Env>;
