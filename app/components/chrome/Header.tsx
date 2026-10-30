import { useEffect, useRef, useState } from "react";
import { useRouteLoaderData, useLocation } from "react-router";
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
// data-driven from the distinct season numbers. Arrow keys move between items, Esc closes and returns
// focus to the button, outside-click/route-change closes.
function EpisodesMenu({ seasons }: { seasons: number[] }) {
  const label = useSnippet("snippet:nav.episodes", "Episodes");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const loc = useLocation();

  const items = [
    { to: "/episodes", label: "All Episodes" },
    ...seasons.map((s) => ({ to: `/season/${s}`, label: `Season ${s}` })),
  ];

  useEffect(() => setOpen(false), [loc.pathname]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  const focusItem = (i: number) => {
    const n = items.length;
    itemRefs.current[((i % n) + n) % n]?.focus();
  };
  const openAndFocus = () => {
    setOpen(true);
    requestAnimationFrame(() => itemRefs.current[0]?.focus());
  };
  const close = () => {
    setOpen(false);
    btnRef.current?.focus();
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            openAndFocus();
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="flex items-center gap-1 rounded px-2 py-1.5 font-display text-sm text-muted hover:text-ink"
      >
        {label}
        <ChevronDown size={14} aria-hidden className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>
      {open && (
        <ul role="menu" aria-label={label} className="absolute left-0 top-full z-40 mt-1 min-w-48 rounded-lg border border-border bg-card p-1 shadow-lg">
          {items.map((it, i) => (
            <li key={it.to} role="none">
              <Link
                role="menuitem"
                to={it.to}
                ref={(el) => { itemRefs.current[i] = el; }}
                onClick={() => setOpen(false)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") { e.preventDefault(); focusItem(i + 1); }
                  else if (e.key === "ArrowUp") { e.preventDefault(); if (i === 0) close(); else focusItem(i - 1); }
                  else if (e.key === "Home") { e.preventDefault(); focusItem(0); }
                  else if (e.key === "End") { e.preventDefault(); focusItem(items.length - 1); }
                  else if (e.key === "Escape") { e.preventDefault(); close(); }
                }}
                className="block rounded px-3 py-2 text-sm text-muted hover:bg-surface hover:text-ink"
              >
                {it.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Header() {
  const seasons = useSeasons();
  const subscribeLabel = useSnippet("snippet:nav.subscribe", "Subscribe");
  const [mobileOpen, setMobileOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setMobileOpen(false), [loc.pathname]);

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
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            onClick={() => setMobileOpen((o) => !o)}
            className="grid h-11 w-11 place-items-center rounded text-muted hover:text-ink"
          >
            {mobileOpen ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <nav id="mobile-menu" aria-label="Mobile" className="border-t border-border bg-bg px-4 py-3 md:hidden">
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
      )}
    </header>
  );
}

function NavLabel({ snippetKey, fallback }: { snippetKey: string; fallback: string }) {
  return <>{useSnippet(snippetKey, fallback)}</>;
}
