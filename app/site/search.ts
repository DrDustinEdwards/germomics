// The search forms (data-keep-focus: /search and the archive's filter) are plain GET forms on a page that sends no
// React, so a search loads the results page afresh. The control the reader submitted from keeps the focus there, as it
// did when React Router submitted the form in place: the field, with the caret at the end, or the button.
import { HYDRATED_ATTRIBUTE } from "../lib/hydration";

const KEY = "germomics-keep-focus";

export function enhanceSearch() {
  document.addEventListener("submit", (event) => {
    const form = event.target;
    // A hydrated page submits in place, and the focus stays without help.
    if (document.documentElement.hasAttribute(HYDRATED_ATTRIBUTE)) return;
    if (!(form instanceof HTMLFormElement) || !form.hasAttribute("data-keep-focus")) return;
    const active = document.activeElement;
    const at = Array.from(form.elements).findIndex((el) => el === active);
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ path: new URL(form.action, location.href).pathname, at }));
    } catch {
      /* storage blocked: the page loads without the focus, as any plain form would */
    }
  });
  let saved: { path?: string; at?: number } | null = null;
  try {
    saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    sessionStorage.removeItem(KEY);
  } catch {
    return;
  }
  if (!saved || saved.path !== location.pathname || typeof saved.at !== "number" || saved.at < 0) return;
  const target = document.querySelector<HTMLFormElement>("form[data-keep-focus]")?.elements[saved.at];
  if (!(target instanceof HTMLElement)) return;
  target.focus();
  if (target instanceof HTMLInputElement && target.type === "search") target.setSelectionRange(target.value.length, target.value.length);
}
