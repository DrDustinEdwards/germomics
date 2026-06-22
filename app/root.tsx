import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import "./app.css";
import { getEnv, getSnippets, siteContentContext } from "~/lib/context.server";
import { loadSettings, loadSnippets } from "~/lib/content.server";
import { themeInitScript } from "~/lib/theme";
import { PlayerProvider } from "~/components/player/player-context";
import { PlayerDock } from "~/components/player/PlayerDock";
import { PlayerSpacer } from "~/components/player/PlayerSpacer";
import { Header } from "~/components/chrome/Header";
import { Footer } from "~/components/chrome/Footer";

export const links: Route.LinksFunction = () => [
  // Modern SVG favicon (scales, theme-agnostic) with raster fallbacks for older agents.
  { rel: "icon", type: "image/svg+xml", href: "/brand/germomics-g.svg" },
  { rel: "icon", href: "/favicon.ico", sizes: "48x48" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
  { rel: "manifest", href: "/site.webmanifest" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
  },
];

// Load site content (settings + snippets) once per request and put it on context, so any loader
// reads it without re-hitting KV. Values are KV-cached in content.server with in-code fallbacks.
export const middleware: Route.MiddlewareFunction[] = [
  async ({ context }, next) => {
    const env = getEnv(context);
    const [settings, snippets] = await Promise.all([loadSettings(env), loadSnippets(env)]);
    context.set(siteContentContext, { settings, snippets });
    return next();
  },
];

// Cloudflare Web Analytics is cookieless (no consent banner needed). The site token comes from
// the dashboard via the CF_BEACON_TOKEN var; the beacon only renders when it's set. Snippets are
// passed to the client so components can read them via useSnippet().
export async function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context) as unknown as { CF_BEACON_TOKEN?: string };
  return { beaconToken: env.CF_BEACON_TOKEN ?? null, snippets: getSnippets(context) };
}

export function Layout({ children }: { children: React.ReactNode }) {
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
        {/* Set data-theme before paint — no flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  // PlayerProvider lives at the root, above the Outlet, so the single <audio> element and the
  // queue survive every client-side navigation (CLAUDE.md §04 — uninterrupted playback).
  return (
    <PlayerProvider>
      {loaderData?.beaconToken ? (
        <script
          defer
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon={JSON.stringify({ token: loaderData.beaconToken })}
        />
      ) : null}
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
      {/* Reserves the player's height so the footer clears the fixed dock while playing. */}
      <PlayerSpacer />
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
