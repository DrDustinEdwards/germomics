import { useLocation, useRouteLoaderData } from "react-router";
import { SiteHeader, type HeaderSection } from "capsomer/react/site-header";
import { Search } from "lucide-react";
import { GMark } from "../brand/GMark";
import { routerLink } from "./router-link";
import { useSnippet } from "~/lib/content";
import { THEME_KEY } from "~/lib/theme";

// Primary nav after the Episodes menu. Labels read from snippet:nav.*.
const NAV = [
  { to: "/writing", key: "snippet:nav.writing", fallback: "Writing" },
  { to: "/archive", key: "snippet:nav.archive", fallback: "Archive" },
  { to: "/data", key: "snippet:nav.data", fallback: "Data" },
  { to: "/games", key: "snippet:nav.games", fallback: "Games" },
] as const;

function useSeasons(): number[] {
  const root = useRouteLoaderData("root") as { seasons?: number[] } | undefined;
  return root?.seasons ?? [];
}

const within = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

/**
 * Capsomer's site header in germomics' look (app.css maps its band to the palette): the G mark and wordmark, the
 * Episodes menu (All Episodes, then one row per season), the sections, Search and Subscribe, and the theme button.
 * `hydrate` is false on a page that sends no React: /site.js wires the same markup (app/site.ts).
 */
export function Header({ hydrate }: { hydrate: boolean }) {
  const { pathname } = useLocation();
  const seasons = useSeasons();
  const episodes = useSnippet("snippet:nav.episodes", "Episodes");
  const subscribe = useSnippet("snippet:nav.subscribe", "Subscribe");
  const labels = {
    "/writing": useSnippet("snippet:nav.writing", "Writing"),
    "/archive": useSnippet("snippet:nav.archive", "Archive"),
    "/data": useSnippet("snippet:nav.data", "Data"),
    "/games": useSnippet("snippet:nav.games", "Games"),
  };

  const sections: HeaderSection[] = [
    {
      id: "episodes",
      label: episodes,
      current: within(pathname, "/episodes") || within(pathname, "/season"),
      groups: [
        {
          links: [
            { label: "All Episodes", href: "/episodes", current: pathname === "/episodes" },
            ...seasons.map((s) => ({
              label: `Season ${s}`,
              href: `/season/${s}`,
              current: pathname === `/season/${s}`,
            })),
          ],
        },
      ],
    },
    ...NAV.map((item) => ({
      id: item.to.slice(1),
      label: labels[item.to],
      href: item.to,
      current: within(pathname, item.to),
    })),
  ];

  return (
    <SiteHeader
      logo={{
        href: "/",
        label: "Germomics",
        className: "germomics-logo",
        mark: <GMark className="h-5 w-auto" />,
        wordmark: (
          <span>
            germ<span className="text-brand">omics</span>
          </span>
        ),
      }}
      sections={sections}
      links="right"
      navLabel="Primary"
      extras={[
        { id: "search", label: "Search", icon: <Search size={16} aria-hidden />, href: "/search" },
        { id: "subscribe", label: subscribe, kind: "button", href: "/subscribe", phone: "bar" },
      ]}
      themePrefKey={THEME_KEY}
      translucent
      skipTo="#main"
      hydrate={hydrate}
      renderLink={routerLink}
    />
  );
}
