// Which pages hydrate. A public page sends no React: its menus, theme button and share buttons run from /site.js
// (app/site.ts), and React Router's boot waits on the page as data until a reader reaches for a play button
// (site-runtime's hydrate on intent; app/site/hydrate.ts), because the player is the one thing on those pages that
// needs the app: one <audio> element that keeps playing while client-side navigation changes the page around it (build
// plan §04). A route that is an app from its first paint (the admin, a game, a data page's map, an episode's player
// surface) opts in with `handle = { hydrate: true }`, or a function of its loader data (site-runtime's routeHydrates).
// Client-safe: /site.js imports the name below.

/**
 * On the <audio> element while it plays a press /site.js started before React loaded: the player adopts it as it is
 * (components/player/player-context.tsx).
 */
export const AUDIO_STARTED_ATTRIBUTE = "data-started-by-press";
