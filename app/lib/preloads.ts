import { type Preload, preloads } from "@dustinedwards/site-runtime/preload";

// Every page's font preloads, declared once: root.tsx's `links`, and with the root stylesheets the `Link` header
// workers/app.ts adds to HTML responses, which Cloudflare Early Hints sends ahead as a 103. Fonts are self-hosted
// (app/fonts.css, served from /fonts): the display weight used in the hero/h1 (the LCP text), so it paints without a
// swap flash; the rest load with font-display: swap. site-runtime adds the `crossorigin` a font preload needs.
export const FONT_PRELOADS: Preload[] = [{ href: "/fonts/space-grotesk-600-latin.woff2", as: "font", type: "font/woff2" }];
export const PRELOADS = preloads(FONT_PRELOADS);
