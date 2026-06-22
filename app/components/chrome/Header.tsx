import { Link, NavLink } from "react-router";
import { ThemeToggle } from "./ThemeToggle";
import { useSnippet } from "~/lib/content";

// Labels read from the snippet:nav.* content blocks (editable in /admin/content), with the
// hard-coded fallback so a missing row never breaks the chrome.
const NAV = [
  { to: "/episodes", key: "snippet:nav.episodes", fallback: "Episodes" },
  { to: "/writing", key: "snippet:nav.writing", fallback: "Writing" },
  { to: "/archive", key: "snippet:nav.archive", fallback: "Archive" },
  { to: "/data", key: "snippet:nav.data", fallback: "Data" },
  { to: "/games", key: "snippet:nav.games", fallback: "Games" },
  { to: "/search", key: "snippet:nav.search", fallback: "Search" },
] as const;

function NavItem({ to, snippetKey, fallback }: { to: string; snippetKey: string; fallback: string }) {
  const label = useSnippet(snippetKey, fallback);
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded px-2 py-1.5 font-display text-sm ${isActive ? "text-brand" : "text-muted hover:text-ink"}`
      }
    >
      {label}
    </NavLink>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-15 max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="font-display text-xl font-semibold tracking-tight text-ink">
          germ<span className="text-brand">omics</span>
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
          {NAV.map((item) => (
            <NavItem key={item.to} to={item.to} snippetKey={item.key} fallback={item.fallback} />
          ))}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
