// /site.js, the one script every page runs, with no framework (devkit's siteScript in vite.config.ts bundles it).
// It is what a public page does in the browser: the header's menus and theme button (Capsomer's), the copy and share buttons (Capsomer's copy), the search forms' focus and, on a page
// that sends no React, the play buttons' hydrate-on-intent. A page that hydrates keeps it too, so the same markup
// behaves the same everywhere. Each part listens on the document, so a page React draws later is covered as well.
import { startPage } from "@dustinedwards/site-runtime/page-client";
import { startIslands } from "@dustinedwards/devkit/islands";
import { enhance as enhanceCopy } from "capsomer/behavior/copy";
import { enhance as enhanceHeader } from "capsomer/behavior/site-header";
import { enhance as enhanceTheme } from "capsomer/behavior/theme-switch";
import { keepFocus } from "capsomer/behavior/field";
import { HYDRATED_ATTRIBUTE } from "./lib/hydration";
import { enhanceHydrateOnIntent } from "./site/hydrate";

// First, before anything renders: the Trusted Types default policy and INP reporting.
startPage();
// Capsomer's header (its Episodes panel, the phone sheet) and theme button, on a page whose header React does not run.
enhanceHeader();
enhanceTheme();
enhanceCopy();
// The search forms (data-keep-focus) are plain GET forms on a page that sends no React: keep the focus after a search.
// A hydrated page submits in place, and the focus stays without help.
keepFocus({
  key: "germomics-keep-focus",
  skip: () => document.documentElement.hasAttribute(HYDRATED_ATTRIBUTE),
});
// The nonce of this script, for the hydration scripts it may add: the page's CSP trusts inline scripts by nonce.
enhanceHydrateOnIntent((document.currentScript as HTMLScriptElement | null)?.nonce ?? "");
// A part of a page that needs its own script (app/islands/, such as the /data charts) loads it only on that page.
startIslands();
