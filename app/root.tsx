import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  UNSAFE_FrameworkContext,
  useLocation,
  useMatches,
} from "react-router";
import { useContext, useEffect, useState } from "react";
import { iconLinks } from "@drdustinedwards/site-helpers/icons";

import type { Route } from "./+types/root";
import "./app.css";
import { getEnv, getSnippets, getSettings, once, siteContentContext } from "~/lib/context.server";
import { loadSettings, loadSnippets, setting } from "~/lib/content.server";
import { getShowConfig } from "~/lib/show.server";
import { listSeasons } from "~/lib/posts.server";
import { themeInitScript } from "~/lib/theme";
import {
  HYDRATED_ATTRIBUTE,
  HYDRATED_EVENT,
  HYDRATE_ON_INTENT_ID,
  STREAM_BUFFER_SCRIPT,
  routeHydrates,
} from "~/lib/hydration";
import { PRELOADS } from "~/lib/preloads";
import { socialLinks } from "~/lib/seo";
import { NO_PREFETCH } from "~/lib/site";
import { PlayerProvider } from "~/components/player/player-context";
import { PlayerDock } from "~/components/player/PlayerDock";
import { Header } from "~/components/chrome/Header";
import { LinkPrefetch } from "capsomer/react/link";
import { Footer } from "~/components/chrome/Footer";

export const links: Route.LinksFunction = () => [
  ...iconLinks(),
  // Feed autodiscovery: the writing feed and the podcast feed (whose URL never changes, CLAUDE.md rule 1).
  { rel: "alternate", type: "application/rss+xml", title: "Germomics: Writing", href: "/feed/site.xml" },
  { rel: "alternate", type: "application/rss+xml", title: "Germomics podcast", href: "/feed/podcast/" },
  // The LCP font, also sent as the Early Hints `Link` header (lib/preloads.ts).
  ...PRELOADS.links,
];

// Site content (settings + snippets) for any loader, read once per request on first use. Nothing is
// awaited here, so the loaders' own D1 queries run in the same round trip (context.server).
export const middleware: Route.MiddlewareFunction[] = [
  ({ context }, next) => {
    const env = getEnv(context);
    context.set(siteContentContext, { settings: once(() => loadSettings(env)), snippets: once(() => loadSnippets(env)) });
    return next();
  },
];

// Cloudflare Web Analytics is injected automatically by Cloudflare (one beacon; Dustin's ruling,
// 2026-10-03), so the app renders none of its own. Snippets are passed to the client so
// components can read them via useSnippet().
export async function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const [settings, snippets, show, seasons] = await Promise.all([
    getSettings(context),
    getSnippets(context),
    getShowConfig(env),
    listSeasons(env),
  ]);
  // Social links for the footer, built from the same settings social.* as Organization sameAs, so
  // footer and schema stay consistent. Only handles that are set produce a link.
  const socials = socialLinks({
    facebook: setting(settings, "social.facebook"),
    twitter: setting(settings, "social.twitter"),
    instagram: setting(settings, "social.instagram"),
  });
  return {
    snippets,
    socials,
    subscribeLinks: show.subscribeLinks ?? {},
    // Distinct episode season numbers (newest first) feed the global Header "Episodes" dropdown.
    seasons,
  };
}

const isServer = typeof document === "undefined";
// In the browser the page hydrates once, so whether it was deferred is fixed then and holds for every client-side
// navigation after it: the hydration scripts below stay one tree, never remounted.
let clientDeferred: boolean | undefined;

/**
 * React Router's hydration scripts. A route that hydrates on load gets them as usual. Any other page gets them inside
 * a <noscript>, which a browser running script keeps as inert text (React renders a <link> there in place rather than
 * hoisting it to the head), so the page downloads no React; /site.js runs them when a reader presses play
 * (app/site/hydrate.ts). Once such a page has hydrated, ScrollRestoration mounts, so client-side navigations restore
 * and reset the scroll as on any other page.
 */
function HydrationScripts({ deferred }: { deferred: boolean }) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  if (!deferred) {
    return (
      <>
        <ScrollRestoration />
        <Scripts />
      </>
    );
  }
  return (
    <>
      <noscript id={HYDRATE_ON_INTENT_ID}>{isServer ? <Scripts /> : null}</noscript>
      {hydrated ? <ScrollRestoration /> : null}
    </>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const nonce = useContext(UNSAFE_FrameworkContext)?.nonce;
  const hydrates = routeHydrates(useMatches());
  const deferred = isServer ? !hydrates : (clientDeferred ??= !hydrates);
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Brand chrome color: crystal violet in light, near-black violet in dark. */}
        <meta name="theme-color" content="#4F2D7F" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#120B1F" media="(prefers-color-scheme: dark)" />
        <Meta />
        <Links />
        {/* Set data-theme before paint — no flash of the wrong theme. The render's nonce lets it run. */}
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* A deferred page keeps its streamed loader data here until it hydrates (lib/hydration.ts). */}
        {deferred ? <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: STREAM_BUFFER_SCRIPT }} /> : null}
        {/* Every page's own script: the menus, the theme button, the share buttons and hydrate-on-intent (app/site.ts). */}
        <script src="/site.js" defer nonce={nonce} suppressHydrationWarning />
      </head>
      <body>
        <LinkPrefetch exclude={NO_PREFETCH}>{children}</LinkPrefetch>
        <HydrationScripts deferred={deferred} />
      </body>
    </html>
  );
}

export default function App() {
  // Tells /site.js the app is live, so a press that started the hydration can be handed to its button.
  useEffect(() => {
    document.documentElement.setAttribute(HYDRATED_ATTRIBUTE, "");
    document.dispatchEvent(new Event(HYDRATED_EVENT));
  }, []);
  // The admin brings its own shell (AdminShell), so it gets none of the public site's chrome.
  const isAdmin = useLocation().pathname.startsWith("/admin");
  if (isAdmin) return <Outlet />;
  // PlayerProvider lives at the root, above the Outlet, so the single <audio> element and the
  // queue survive every client-side navigation (CLAUDE.md §04 — uninterrupted playback).
  return (
    <PlayerProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-brand focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <Header />
      <main id="main" className="mx-auto min-h-[60vh] max-w-5xl px-4 pb-12 pt-6">
        <Outlet />
      </main>
      <Footer />
      {/* Clearance is handled by the dock measuring its own height into --player-h, which the
          body reserves as padding-bottom (see app.css), so the footer always clears the dock. */}
      <PlayerDock />
    </PlayerProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pt-16">
      <h1 className="font-display text-4xl font-semibold text-brand">{message}</h1>
      <p className="mt-3 text-muted">{details}</p>
      {stack && (
        <pre className="mt-4 w-full overflow-x-auto rounded bg-surface p-4 text-sm">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
