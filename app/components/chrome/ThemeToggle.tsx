import { Moon, Sun } from "lucide-react";

// Light/dark toggle. The markup only: /site.js switches the theme and keeps the label true (app/site/theme.ts), on a
// page that sends no React as on one that hydrates. Both icons are rendered and app.css shows the one for the theme
// in force (the no-flash script in root.tsx has already set data-theme), so the icon is right from the first paint.
// The label starts as the dark theme's, as it always rendered. `className` lets a caller append utilities (the
// mobile header tightens the padding at very narrow widths).
export function ThemeToggle({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      data-theme-toggle
      aria-label="Switch to light theme"
      className={`tap-target grid place-items-center rounded-full border border-border bg-surface p-2 text-ink hover:border-brand ${className}`}
    >
      <Sun size={16} aria-hidden className="theme-icon-sun" />
      <Moon size={16} aria-hidden className="theme-icon-moon" />
    </button>
  );
}
