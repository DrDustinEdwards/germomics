// The theme button (components/chrome/ThemeToggle.tsx): switches light and dark, remembers the choice and keeps the
// button's label naming the theme it switches to. app.css shows its icon.
import { applyTheme, effectiveTheme } from "../lib/theme";

function syncLabels() {
  const label = `Switch to ${effectiveTheme() === "dark" ? "light" : "dark"} theme`;
  for (const button of document.querySelectorAll("[data-theme-toggle]")) button.setAttribute("aria-label", label);
}

export function enhanceTheme() {
  syncLabels();
  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element) || !event.target.closest("[data-theme-toggle]")) return;
    applyTheme(effectiveTheme() === "dark" ? "light" : "dark");
    syncLabels();
  });
  // With no choice stored the page follows the system, so its label does too.
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncLabels);
}
