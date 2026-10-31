import { useRouteLoaderData } from "react-router";
import { Link, NavLink } from "capsomer/react/link";
import { ChevronDown, Menu, Search, X } from "lucide-react";
import { GMark } from "../brand/GMark";
import { ThemeToggle } from "./ThemeToggle";
import { useSnippet } from "~/lib/content";

// Primary nav (Episodes is a season dropdown, handled separately). Labels read from snippet:nav.*.
const NAV = [
  { to: "/writing", key: "snippet:nav.writing", fallback: "Writing" },
  { to: "/archive", key: "snippet:nav.archive", fallback: "Archive" },
  { to: "/data", key: "snippet:nav.data", fallback: "Data" },
  { to: "/games", key: "snippet:nav.games", fallback: "Games" },
] as const;

const navCx = ({ isActive }: { isActive: boolean }) =>
  `rounded px-2 py-1.5 font-display text-sm ${isActive ? "text-brand" : "text-muted hover:text-ink"}`;

function useSeasons(): number[] {
  const root = useRouteLoaderData("root") as { seasons?: number[] } | undefined;
  return root?.seasons ?? [];
}

// Accessible Episodes dropdown: a disclosure button + menu of links (All Episodes + one per season),
// data-driven from the distinct season numbers. The markup only: /site.js opens and closes it (app/site/menus.ts),
// on a page that sends no React as on one that hydrates. Arrow keys move between items, Esc closes and returns
// focus to the button, an outside press or a followed link closes.
function EpisodesMenu({ seasons }: { seasons: number[] }) {
  const label = useSnippet("snippet:nav.episodes", "Episodes");
  const items = [
    { to: "/episodes", label: "All Episodes" },
    ...seasons.map((s) => ({ to: `/season/${s}`, label: `Season ${s}` })),
  ];

  return (
    <div className="relative" data-menu>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded="false"
        data-menu-button
        className="flex items-center gap-1 rounded px-2 py-1.5 font-display text-sm text-muted hover:text-ink"
      >
        {label}
        <ChevronDown size={14} aria-hidden className="transition-transform" data-menu-chevron />
      </button>
      <ul role="menu" aria-label={label} hidden className="absolute left-0 top-full z-40 mt-1 min-w-48 rounded-lg border border-border bg-card p-1 shadow-lg">
        {items.map((it) => (
          <li key={it.to} role="none">
            <Link role="menuitem" to={it.to} className="block rounded px-3 py-2 text-sm text-muted hover:bg-surface hover:text-ink">
              {it.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Header() {
  const seasons = useSeasons();
  const subscribeLabel = useSnippet("snippet:nav.subscribe", "Subscribe");

  const subscribeCta =
    "rounded-full bg-brand px-3 py-1.5 font-display text-sm font-medium text-white hover:bg-brand-strong";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-15 max-w-5xl items-center justify-between gap-4 px-4 py-3 max-[374px]:gap-1">
        <Link to="/" className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight text-ink">
          {/* Hexagon G brand mark (themes via currentColor: brand purple light / lavender dark). Sized
              near the wordmark cap height and a touch under the old mic since the hexagon reads heavier. */}
          <GMark className="h-5 w-auto" />
          <span>germ<span className="text-brand">omics</span></span>
        </Link>

        {/* Desktop nav */}
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          <EpisodesMenu seasons={seasons} />
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className={navCx}>
              <NavLabel snippetKey={item.key} fallback={item.fallback} />
            </NavLink>
          ))}
          <Link to="/subscribe" className={subscribeCta}>{subscribeLabel}</Link>
          <Link
            to="/search"
            aria-label="Search"
            className="tap-target grid place-items-center rounded-full border border-border bg-surface p-2 text-muted hover:border-brand hover:text-ink"
          >
            <Search size={16} aria-hidden />
          </Link>
          <ThemeToggle />
        </nav>

        {/* Mobile controls: search + Subscribe stay visible in the bar so neither needs a hamburger tap.
            At <=374px the wordmark plus four controls would overflow 320px (pushing the hamburger off
            screen), so the group tightens there: no inter-item gap, smaller icon padding, and a compact
            Subscribe pill. All of it is restored above 374px, so 375px and up are unchanged. */}
        <div className="flex items-center gap-1 md:hidden max-[374px]:gap-0">
          <ThemeToggle className="max-[374px]:p-1" />
          <Link
            to="/search"
            aria-label="Search"
            className="tap-target grid place-items-center rounded-full border border-border bg-surface p-2 text-muted hover:border-brand hover:text-ink max-[374px]:p-1"
          >
            <Search size={16} aria-hidden />
          </Link>
          <Link to="/subscribe" className={`${subscribeCta} max-[374px]:px-1.5 max-[374px]:text-xs`}>{subscribeLabel}</Link>
          {/* /site.js opens and closes it (app/site/menus.ts), swapping the label and the icon. */}
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded="false"
            aria-controls="mobile-menu"
            className="grid h-11 w-11 place-items-center rounded text-muted hover:text-ink"
          >
            <Menu size={20} aria-hidden data-menu-closed />
            <X size={20} aria-hidden className="hidden" data-menu-open />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <nav id="mobile-menu" aria-label="Mobile" hidden className="border-t border-border bg-bg px-4 py-3 md:hidden">
        <ul className="space-y-1">
          <li><Link to="/episodes" className="block rounded px-2 py-2 font-display text-sm text-ink">All Episodes</Link></li>
          {seasons.map((s) => (
            <li key={s}><Link to={`/season/${s}`} className="block rounded px-2 py-2 pl-5 text-sm text-muted hover:text-ink">Season {s}</Link></li>
          ))}
          {NAV.map((item) => (
            <li key={item.to}>
              <Link to={item.to} className="block rounded px-2 py-2 font-display text-sm text-muted hover:text-ink">
                <NavLabel snippetKey={item.key} fallback={item.fallback} />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}

function NavLabel({ snippetKey, fallback }: { snippetKey: string; fallback: string }) {
  return <>{useSnippet(snippetKey, fallback)}</>;
}
