// The per-request Cloudflare bindings, carried on React Router v8's stabilized context.
//
// CLAUDE.md hard rule #1 says reach D1/R2/KV "through context ... inside loaders and actions."
// RR v8 stabilized middleware/context, so the loader `context` is a RouterContextProvider and
// the binding bag is read with context.get(key) rather than a bare context.cloudflare.env
// property. getEnv() is the one sanctioned accessor — every loader/action/middleware goes
// through it, so bindings never become a free-floating global and never reach the client.
import { createContext, type RouterContextProvider } from "react-router";

export type CloudflareBindings = { env: Env; ctx: ExecutionContext };

export const cloudflareContext = createContext<CloudflareBindings>();

export function getEnv(context: Readonly<RouterContextProvider>): Env {
  return context.get(cloudflareContext).env;
}

export function getExecutionCtx(context: Readonly<RouterContextProvider>): ExecutionContext {
  return context.get(cloudflareContext).ctx;
}
