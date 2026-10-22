// The per-request Cloudflare bindings, carried on React Router v8's stabilized context.
//
// Loaders and actions reach D1/R2/KV through context.
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

// Per-request site content (settings + snippets), loaded once by the root middleware and read by any
// loader via getSettings()/getSnippets(). Values are KV-cached in content.server; this just carries
// the resolved maps so a request hits KV at most once.
export type SiteContent = {
  settings: Record<string, string>;
  snippets: Record<string, string>;
};
export const siteContentContext = createContext<SiteContent>();

export function getSettings(context: Readonly<RouterContextProvider>): Record<string, string> {
  return context.get(siteContentContext).settings;
}
export function getSnippets(context: Readonly<RouterContextProvider>): Record<string, string> {
  return context.get(siteContentContext).snippets;
}
