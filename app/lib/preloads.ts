import spaceGroteskUrl from "~/fonts/space-grotesk-latin.woff2?url";
import frauncesUrl from "~/fonts/fraunces-latin.woff2?url";
import { type Preload, preloads } from "@dustinedwards/site-runtime/preload";

// Every page's font preloads, declared once: root.tsx's `links`, and with the root stylesheets the `Link` header
// workers/app.ts adds to HTML responses, which Cloudflare Early Hints sends ahead as a 103. Fonts are self-hosted
// (app/fonts, built through Vite so each URL is hashed and cached immutable; app/fonts.css), one variable file per family covering every weight, with font-display:
// optional, so a face that misses its ~100 ms window leaves the visit in its size-matched fallback and text never
// moves (D5). The two faces every page draws above the fold, so they arrive in time: Space Grotesk (headings, nav)
// and Fraunces (body text). JetBrains Mono draws only numbers further down. site-runtime adds the `crossorigin` a
// font preload needs.
export const FONT_PRELOADS: Preload[] = [
  { href: spaceGroteskUrl, as: "font", type: "font/woff2" },
  { href: frauncesUrl, as: "font", type: "font/woff2" },
];
export const PRELOADS = preloads(FONT_PRELOADS);
