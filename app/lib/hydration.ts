// Which pages hydrate. A public page sends no React: its menus, theme button and share buttons run from /site.js
// (app/site.ts), and React Router's hydration scripts wait inert in a <noscript> until a reader presses play
// (app/site/hydrate.ts), because the player is the one thing on those pages that needs the app: one <audio> element
// that keeps playing while client-side navigation changes the page around it (build plan §04). A route that is an app
// from its first paint (the admin, a game, a data page's map, an episode's player surface) opts in with
// `handle = { hydrate: true }`, or a function of its loader data. Client-safe: /site.js imports the names below.

/** The <noscript> that holds a deferred page's hydration scripts as text. */
export const HYDRATE_ON_INTENT_ID = "hydrate-on-intent";

/** The event the app dispatches on `document` once it has hydrated (root.tsx), and the attribute it sets on <html>. */
export const HYDRATED_EVENT = "germomics:hydrated";
export const HYDRATED_ATTRIBUTE = "data-hydrated";

/** Where the buffer below keeps the loader data until the real handoff exists. */
export const STREAM_BUFFER = "__germomicsStream";

/**
 * React Router streams the page's loader data after the document as inline scripts that call
 * `window.__reactRouterContext.streamController`, which its hydration script creates. On a deferred page that script
 * has not run, so this one, inline in the head, stands in and keeps each chunk; the press that hydrates the page hands
 * them to the real controller. The text is fixed, so the page's nonce covers it like the theme script.
 */
export const STREAM_BUFFER_SCRIPT = `window.${STREAM_BUFFER}={chunks:[],closed:false};window.__reactRouterContext={streamController:{enqueue:function(c){window.${STREAM_BUFFER}.chunks.push(c)},close:function(){window.${STREAM_BUFFER}.closed=true}}};`;

export const isServer = typeof document === "undefined";

// In the browser the page hydrates once, so whether it was deferred is fixed then and holds for every client-side
// navigation after it: the hydration scripts (root.tsx) stay one tree, never remounted, and the header keeps one form.
let clientDeferred: boolean | undefined;

/** Whether this page's React waits for a press: on the server the route says; in the browser the first page decides. */
export function pageDeferred(hydrates: boolean): boolean {
  return isServer ? !hydrates : (clientDeferred ??= !hydrates);
}
