import {
  Links,
  Meta,
  Outlet,
  UNSAFE_FrameworkContext,
  useLocation,
  useMatches,
} from "react-router";
import { useContext } from "react";
import { iconLinks } from "@drdustinedwards/site-helpers/icons";

import type { Route } from "./+types/root";
import "./app.css";
import { getEnv } from "@dustinedwards/site-runtime/context";
import { getSnippets, getSettings, once, siteContentContext } from "~/lib/context.server";
import { loadSettings, loadSnippets, setting } from "~/lib/content.server";
import { getShowConfig } from "~/lib/show.server";
import { listSeasons } from "~/lib/posts.server";
import { themeInitScript } from "~/lib/theme";
import { pageDeferred } from "~/lib/hydration";
import {
  HydrationScripts,
  StreamBuffer,
  routeHydrates,
} from "@dustinedwards/site-runtime/deferred-scripts";
import { PRELOADS } from "~/lib/preloads";
import { socialLinks } from "~/lib/seo";
import { NO_PREFETCH } from "~/lib/site";
import { LinkPrefetch } from "capsomer/react/link";
import { ErrorPage, errorTitle } from "capsomer/react/error-page";
import errorPageCss from "./error-page.css?url";
import { markup } from "capsomer/behavior/trusted-html";
import { documentAttrs } from "capsomer/behavior/document";

export const links: Route.LinksFunction = () => [
  ...iconLinks(),
  // Feed autodiscovery: the writing feed and the podcast feed (whose URL never changes, CLAUDE.md rule 1).
  {
    rel: "alternate",
    type: "application/rss+xml",
    title: "Germomics: Writing",
    href: "/feed/site.xml",
  },
  {
    rel: "alternate",
    type: "application/rss+xml",
    title: "Germomics podcast",
    href: "/feed/podcast/",
  },
  // The LCP font, also sent as the Early Hints `Link` header (lib/preloads.ts).
  ...PRELOADS.links,
];

// An unmatched address matches only the root, so the error path's title is set here (WCAG 2.4.2).
export function meta({ error }: Route.MetaArgs): Route.MetaDescriptors {
  return error ? [{ title: errorTitle(error, "Germomics") }] : [];
}

// Site content (settings + snippets) for any loader, read once per request on first use. Nothing is
// awaited here, so the loaders' own D1 queries run in the same round trip (context.server).
export const middleware: Route.MiddlewareFunction[] = [
  ({ context }, next) => {
    const env = getEnv(context);
    context.set(siteContentContext, {
      settings: once(() => loadSettings(env)),
      snippets: once(() => loadSnippets(env)),
    });
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

export function Layout({ children }: { children: React.ReactNode }) {
  const nonce = useContext(UNSAFE_FrameworkContext)?.nonce;
  const hydrates = routeHydrates(useMatches());
  const deferred = pageDeferred(hydrates);
  // The public pages take germomics' palette from Capsomer's site entry; the admin keeps Capsomer's own look.
  const site = useLocation().pathname.startsWith("/admin") ? undefined : "germomics";
  return (
    <html lang="en" {...documentAttrs({ site })}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="text-scale" content="scale" />
        {/* Brand chrome color: crystal violet in light, near-black violet in dark. */}
        <meta name="theme-color" content="#4F2D7F" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#120B1F" media="(prefers-color-scheme: dark)" />
        <Meta />
        <Links />
        {/* Set data-theme before paint — no flash of the wrong theme. The render's nonce lets it run. */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={markup(themeInitScript)}
        />
        {/* A deferred page keeps its streamed loader data here until it hydrates (lib/hydration.ts). */}
        <StreamBuffer deferred={deferred} />
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
  // The public chrome (header, footer, player) is the public layout's (routes/_site.tsx), so the admin never loads it.
  return <Outlet />;
}

// Capsomer's error page: the failed Empty in plain words for 404, 410 and server errors, never indexed, the stack only
// in development. Its styles load with it alone (app/error-page.css).
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return (
    <>
      <link rel="stylesheet" href={errorPageCss} precedence="default" />
      <ErrorPage error={error} home="/" dev={import.meta.env.DEV} />
    </>
  );
}
