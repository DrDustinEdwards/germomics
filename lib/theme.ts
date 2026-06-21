// lib/theme.ts data-theme switching. Dark is the default (tokens live in :root); light is
// :root[data-theme='light']. Choice persists to localStorage 'germomics-theme'. The inline
// script runs before paint to avoid a flash; the toggle is used by the client chrome.

export const THEME_STORAGE_KEY = 'germomics-theme';
export type Theme = 'dark' | 'light';

// Injected into <head> via a beforeInteractive inline script. Resolves the stored choice
// (or the system preference) and sets data-theme before first paint.
export const THEME_INIT_SCRIPT = `(function(){try{var k='${THEME_STORAGE_KEY}';var s=localStorage.getItem(k);var t=s||(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

/** Read the current applied theme (client only). */
export function currentTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

/** Flip and persist the theme (client only). Returns the new value. */
export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // ignore storage failures (private mode)
  }
  return next;
}
