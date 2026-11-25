import { lazy, Suspense } from "react";
import { Outlet, useMatches } from "react-router";
import { ErrorPage, errorTitle } from "capsomer/react/error-page";
import { PlayerProvider, usePlayer } from "capsomer/react/player-context";
import { routeHydrates } from "@dustinedwards/site-runtime/deferred-scripts";
import { Header } from "~/components/chrome/Header";
import { Footer } from "~/components/chrome/Footer";
import { routerLink } from "~/components/chrome/router-link";
import { pageDeferred } from "~/lib/hydration";
import errorPageCss from "../error-page.css?url";
import type { Route } from "./+types/_site";
import "../site.css";

// Media Session's lock-screen picture when an episode has none.
const SHOW_ARTWORK = [
  { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
  { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
];

// The dock loads only once an episode is loaded.
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

// The public pages' frame and their stylesheet (app/site.css); the admin has its own shell. A page that throws draws its error page in this frame.
function Frame({ children }: { children: React.ReactNode }) {
  // The header keeps one form across navigation (lib/hydration.ts).
  const hydrates = routeHydrates(useMatches());
  // Above the Outlet so the single <audio> element and the queue survive client-side navigation.
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
      <main id="main" className="gm-main">
        {children}
      </main>
      <Footer />
      {/* The dock measures its own height into --cap-player-dock-h, which Capsomer's player.css
          reserves under the body and the scroll, so the footer and an anchor always clear it. */}
      <Dock />
    </PlayerProvider>
  );
}

export default function Site() {
  return (
    <Frame>
      <Outlet />
    </Frame>
  );
}

export function meta({ error }: Route.MetaArgs): Route.MetaDescriptors {
  return error ? [{ title: errorTitle(error, "Germomics") }] : [];
}

// The frame's main wraps the error page, so it is a div: one main.
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <Frame>
      <link rel="stylesheet" href={errorPageCss} precedence="default" />
      <ErrorPage error={error} home="/" as="div" dev={import.meta.env.DEV} />
    </Frame>
  );
}
