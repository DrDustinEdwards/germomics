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

// The Content-Security-Policy nonce this render puts on its inline scripts (workers/app.ts, app/entry.server.tsx).
export const cspNonceContext = createContext<string | undefined>(undefined);

export function getEnv(context: Readonly<RouterContextProvider>): Env {
  return context.get(cloudflareContext).env;
}

// Per-request site content (settings + snippets), read from D1 at most once per request and only
// when a loader asks: the root middleware puts a memoized reader on context, so loaders start it
// alongside their own queries instead of after it, and the feeds and other resource routes that
// never ask cost nothing.
type StrMap = Record<string, string>;
export type SiteContent = { settings: () => Promise<StrMap>; snippets: () => Promise<StrMap> };
export const siteContentContext = createContext<SiteContent>();

export function once<T>(read: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () => (pending ??= read());
}

export function getSettings(context: Readonly<RouterContextProvider>): Promise<StrMap> {
  return context.get(siteContentContext).settings();
}
export function getSnippets(context: Readonly<RouterContextProvider>): Promise<StrMap> {
  return context.get(siteContentContext).snippets();
}
