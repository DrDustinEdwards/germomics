// Which pages hydrate. A public page sends no React: its menus, theme button and share buttons run from /site.js
// (app/site.ts), and React Router's boot waits as JSON until a reader presses play
// (app/site/hydrate.ts), because the player is the one thing on those pages that needs the app: one <audio> element
// that keeps playing while client-side navigation changes the page around it (build plan §04). A route that is an app
// from its first paint (the admin, a game, a data page's map, an episode's player surface) opts in with
// `handle = { hydrate: true }`, or a function of its loader data.

const isServer = typeof document === "undefined";

// In the browser the page hydrates once, so whether it was deferred is fixed then and holds for every client-side
// navigation after it: the hydration scripts (root.tsx) stay one tree, never remounted, and the header keeps one form.
let clientDeferred: boolean | undefined;

/** Whether this page's React waits for a press: on the server the route says; in the browser the first page decides. */
export function pageDeferred(hydrates: boolean): boolean {
  return isServer ? !hydrates : (clientDeferred ??= !hydrates);
}
