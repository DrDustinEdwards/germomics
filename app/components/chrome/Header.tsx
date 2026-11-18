import { useLocation, useRouteLoaderData } from "react-router";
import { SiteHeader, type HeaderSection } from "capsomer/react/site-header";
import { Icon, iconSearch } from "capsomer/react/icons";
import { GMark } from "../brand/GMark";
import { routerLink } from "./router-link";
import { THEME_KEY } from "~/lib/theme";

// Primary nav after the Episodes menu.
const NAV = [
  { to: "/writing", label: "Writing" },
  { to: "/archive", label: "Archive" },
  { to: "/data", label: "Data" },
  { to: "/games", label: "Games" },
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

  const sections: HeaderSection[] = [
    {
      id: "episodes",
      label: "Episodes",
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
      label: item.label,
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
        mark: <GMark className="gm-header-mark" />,
        wordmark: (
          <span>
            germ<span className="gm-brand">omics</span>
          </span>
        ),
      }}
      sections={sections}
      links="right"
      navLabel="Primary"
      extras={[
        { id: "search", label: "Search", icon: <Icon d={iconSearch} />, href: "/search" },
        { id: "subscribe", label: "Subscribe", kind: "button", href: "/subscribe", phone: "bar" },
      ]}
      themePrefKey={THEME_KEY}
      translucent
      skipTo="#main"
      hydrate={hydrate}
      renderLink={routerLink}
    />
  );
}
