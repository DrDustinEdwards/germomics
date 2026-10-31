// /site.js, the one script every page runs, with no framework (devkit's siteScript in vite.config.ts bundles it).
// It is what a public page does in the browser: the theme button, the header menus, the share buttons and, on a page
// that sends no React, the play buttons' hydrate-on-intent. A page that hydrates keeps it too, so the same markup
// behaves the same everywhere. Each part listens on the document, so a page React draws later is covered as well.
import { enhanceHydrateOnIntent } from "./site/hydrate";
import { enhanceMenus } from "./site/menus";
import { enhanceShare } from "./site/share";
import { enhanceTheme } from "./site/theme";

enhanceTheme();
enhanceMenus();
enhanceShare();
// The nonce of this script, for the hydration scripts it may add: the page's CSP trusts inline scripts by nonce.
enhanceHydrateOnIntent((document.currentScript as HTMLScriptElement | null)?.nonce ?? "");
