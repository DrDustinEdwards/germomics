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

/**
 * On the <audio> element while it plays a press /site.js started before React loaded: the player adopts it as it is
 * (components/player/player-context.tsx).
 */
export const AUDIO_STARTED_ATTRIBUTE = "data-started-by-press";

/** Where the buffer below keeps the loader data until the real handoff exists. */
export const STREAM_BUFFER = "__germomicsStream";

/**
 * React Router streams the page's loader data after the document as inline scripts that call
 * `window.__reactRouterContext.streamController`, which its hydration script creates. On a deferred page that script
 * has not run, so this one, inline in the head, stands in and keeps each chunk; the press that hydrates the page hands
 * them to the real controller. The text is fixed, so the page's nonce covers it like the theme script.
 */
export const STREAM_BUFFER_SCRIPT = `window.${STREAM_BUFFER}={chunks:[],closed:false};window.__reactRouterContext={streamController:{enqueue:function(c){window.${STREAM_BUFFER}.chunks.push(c)},close:function(){window.${STREAM_BUFFER}.closed=true}}};`;

type HydrateHandle = { hydrate?: boolean | ((data: unknown) => boolean) };

/** True when a matched route hydrates on load: its handle says so, or says so of its loader data. */
export function routeHydrates(matches: readonly { handle?: unknown; loaderData?: unknown }[]): boolean {
  return matches.some((match) => {
    const hydrate = (match.handle as HydrateHandle | undefined)?.hydrate;
    return typeof hydrate === "function" ? hydrate(match.loaderData) : hydrate === true;
  });
}
