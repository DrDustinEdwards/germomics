// /site.js, the one script every page runs, with no framework (devkit's siteScript in vite.config.ts bundles it).
// It is what a public page does in the browser: the theme button, the header menus, the share buttons, the search forms' focus and, on a page
// that sends no React, the play buttons' hydrate-on-intent. A page that hydrates keeps it too, so the same markup
// behaves the same everywhere. Each part listens on the document, so a page React draws later is covered as well.
import { startIslands } from "@dustinedwards/devkit/islands";
import { enhanceHydrateOnIntent } from "./site/hydrate";
import { enhanceMenus } from "./site/menus";
import { enhanceSearch } from "./site/search";
import { enhanceShare } from "./site/share";
import { enhanceTheme } from "./site/theme";

enhanceTheme();
enhanceMenus();
enhanceShare();
enhanceSearch();
// The nonce of this script, for the hydration scripts it may add: the page's CSP trusts inline scripts by nonce.
enhanceHydrateOnIntent((document.currentScript as HTMLScriptElement | null)?.nonce ?? "");
// A part of a page that needs its own script (app/islands/, such as the /data charts) loads it only on that page.
startIslands();
