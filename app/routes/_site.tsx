import { lazy, Suspense } from "react";
import { Outlet, useMatches } from "react-router";
import { PlayerProvider, usePlayer } from "capsomer/react/player-context";
import { routeHydrates } from "@dustinedwards/site-runtime/deferred-scripts";
import { Header } from "~/components/chrome/Header";
import { Footer } from "~/components/chrome/Footer";
import { routerLink } from "~/components/chrome/router-link";
import { pageDeferred } from "~/lib/hydration";
import "../site.css";

// The lock screen's picture when an episode has none of its own (Media Session).
const SHOW_ARTWORK = [
  { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
  { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
];

// The dock, with its menus and its bottom sheet, loads only once an episode is loaded: no page needs it before then.
const PlayerDock = lazy(() =>
  import("capsomer/react/player").then(({ PlayerDock }) => ({ default: PlayerDock })),
);

function Dock() {
  if (!usePlayer().current) return null;
  return (
    <Suspense fallback={null}>
      <PlayerDock renderLink={routerLink} />
    </Suspense>
  );
}

// The public pages' layout: the header, footer and player dock, and the stylesheet only these pages use (app/site.css:
// Capsomer's header, player and reading contexts in the site's look). The admin brings its own shell (AdminShell), so
// it loads none of this.
export default function Site() {
  // Whether this page's React runs from load (lib/hydration.ts), so the header keeps one form across navigation.
  const hydrates = routeHydrates(useMatches());
  // PlayerProvider sits above the Outlet, so the single <audio> element and the queue survive every client-side
  // navigation between public pages (uninterrupted playback).
  return (
    <PlayerProvider
      storagePrefix="germomics-"
      artist="Germomics"
      album="Germomics"
      noun="episode"
      artwork={SHOW_ARTWORK}
    >
      {/* The header carries the skip link. It runs as React only on a page that hydrates on load. */}
      <Header hydrate={!pageDeferred(hydrates)} />
      <main id="main" className="mx-auto min-h-[60vh] max-w-5xl px-4 pb-12 pt-6">
        <Outlet />
      </main>
      <Footer />
      {/* The dock measures its own height into --cap-player-dock-h, which Capsomer's player.css
          reserves under the body and the scroll, so the footer and an anchor always clear it. */}
      <Dock />
    </PlayerProvider>
  );
}
