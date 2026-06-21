// Client-safe theme helper. data-theme on <html> drives light/dark; the choice is remembered
// in localStorage. The no-flash script below runs before paint so there is no theme flicker.
import type { Theme } from "./types";

export const THEME_KEY = "germomics-theme";

export function storedTheme(): Theme | null {
  if (typeof localStorage === "undefined") return null;
  const v = localStorage.getItem(THEME_KEY);
  return v === "light" || v === "dark" ? v : null;
}

export function systemTheme(): Theme {
  if (typeof window === "undefined") return "dark"; // dark is canonical for share images
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function effectiveTheme(): Theme {
  return storedTheme() ?? systemTheme();
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* private mode */
  }
}

// Inlined into <head> by root.tsx so the attribute is set before first paint.
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;
