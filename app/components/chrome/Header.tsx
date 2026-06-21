import { Link, NavLink } from "react-router";
import { ThemeToggle } from "./ThemeToggle";

const NAV: Array<[string, string]> = [
  ["/episodes", "Episodes"],
  ["/writing", "Writing"],
  ["/archive", "Archive"],
  ["/data", "Data"],
  ["/games", "Games"],
];

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-15 max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="font-display text-xl font-semibold tracking-tight text-ink">
          germ<span className="text-brand">omics</span>
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
          {NAV.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `rounded px-2 py-1.5 font-display text-sm ${
                  isActive ? "text-brand" : "text-muted hover:text-ink"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
