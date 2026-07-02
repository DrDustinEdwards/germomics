import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, effectiveTheme } from "~/lib/theme";
import type { Theme } from "~/lib/types";

// Light/dark toggle. Starts from the effective theme after mount (the no-flash script in
// root.tsx already set data-theme before paint, so there is no flicker). `className` lets a caller
// append utilities (the mobile header tightens the padding at very narrow widths); default is none,
// so every existing call site is unchanged.
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => setTheme(effectiveTheme()), []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      className={`tap-target grid place-items-center rounded-full border border-border bg-surface p-2 text-ink hover:border-brand ${className}`}
    >
      {theme === "dark" ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
    </button>
  );
}
