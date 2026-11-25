// The six episode figures: Prelum's hash of the essay's :::diagram Mermaid selects a drawing, and the caption stays.
// The SVG lives in a static file read through the ASSETS binding; without it the Mermaid image stays in place.

import { fnv1a32 } from "@dustinedwards/site-runtime/encoding";

const FILES: Record<string, string> = {
  "52d7f101": "/blog-diagrams/on-the-right-taq.html",
  "650ac145": "/blog-diagrams/confessions-of-a-cholera-girl.html",
  bd4cca82: "/blog-diagrams/one-flew-over-the-kuru-nest.html",
  "37c8d7c7": "/blog-diagrams/rabies-day-out.html",
  eddeb2d1: "/blog-diagrams/hell-on-weils.html",
  "56832a80": "/blog-diagrams/antitoxin-togo-please.html",
};

export type DiagramFiles = ReadonlyMap<string, string>;

export type DiagramAssets = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

/** FNV-1a of template version 1 and the normalized Mermaid source (Prelum's diagram key). */
export function diagramKey(source: string): string {
  const normalized = source.replace(/\r\n/g, "\n").replace(/\s+$/, "").replace(/^\n+/, "");
  return fnv1a32(`1\n${normalized}`);
}

const ASSET_ORIGIN = "https://assets.local";

/** html_handling redirects /name.html to /name (not ok), so the first hop alone would drop every drawing. */
async function readAsset(assets: DiagramAssets, path: string): Promise<string> {
  let url = new URL(path, ASSET_ORIGIN);
  for (let hop = 0; hop < 2; hop += 1) {
    // manual: a followed redirect would leave the assets binding; the 307 is read by the next loop turn.
    const response = await assets.fetch(url, { redirect: "manual" });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return "";
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) return "";
    const text = await response.text();
    return text.includes("<svg") ? text : "";
  }
  return "";
}

export async function diagramsFromAssets(assets: DiagramAssets | undefined): Promise<DiagramFiles> {
  if (!assets) return new Map();
  const entries = await Promise.all(
    Object.entries(FILES).map(async ([key, path]) => [key, await readAsset(assets, path)] as const),
  );
  return new Map(entries.filter((entry) => entry[1] !== ""));
}

export async function loadBlogDiagrams(env: Env): Promise<DiagramFiles> {
  return diagramsFromAssets(env.ASSETS);
}

const FIGURE = /<figure\b[^>]*\bclass="diagram-figure"[^>]*>[\s\S]*?<\/figure>/g;
const LIGHT = /\/diagrams\/germomics-([0-9a-f]{8})-light\.svg/;

const CONTEXT_OPEN = '<div data-context="prose" class="diagram-context">';
// A drawing with its credit (a hand-written `.blog-diagram-block`) is held whole, so the credit is drawn as one too;
// any other diagram figure on its own. Neither when it is already held, nor a figure inside a block.
const UNWRAPPED =
  /(?<!<div data-context="prose" class="diagram-context">)(?:<div class="blog-diagram-block">[\s\S]*?<\/figure>(?:\s*<p class="blog-diagram-credit">[\s\S]*?<\/p>)?\s*<\/div>|(?<!<div class="blog-diagram-block">\s*)<figure\b[^>]*\bclass="(?:blog-diagram|diagram-figure)"[^>]*>[\s\S]*?<\/figure>)/g;

/** Wraps each diagram in its own reading context (Capsomer's --diagram-* tokens). Idempotent. */
export function inDiagramContext(html: string): string {
  if (!html.includes("diagram")) return html;
  return html.replace(UNWRAPPED, (figure) => `${CONTEXT_OPEN}${figure}</div>`);
}

/** A figure inlined at an earlier render, with role="img" on the figure or on the drawing. Its key is the drawing's title id. */
const INLINED = /<figure class="blog-diagram"[^>]*>(<svg\b[\s\S]*?<\/svg>)/g;
const TITLE_KEY = /<title id="bd-([0-9a-f]{8})-title"/;

/** The current drawing for a key. role="img" sits on the drawing, not the figure: an image's children are presentational, so on the figure the caption's source links would be nested interactive controls. */
function drawing(files: DiagramFiles, key: string): string | undefined {
  const svg = /<svg\b[\s\S]*<\/svg>/.exec(files.get(key) ?? "")?.[0];
  return svg
    ?.replace(
      "<svg",
      `<svg role="img" aria-labelledby="bd-${key}-title" aria-describedby="bd-${key}-desc"`,
    )
    .replace("<title>", `<title id="bd-${key}-title">`)
    .replace("<desc>", `<desc id="bd-${key}-desc">`);
}

export function drawsDiagrams(html: string): boolean {
  return html.includes("diagram-figure") || html.includes('aria-labelledby="bd-');
}

/** Replaces a known Mermaid figure, or an earlier inlined drawing, with the current drawing; the caption stays. */
export function inlineBlogDiagrams(html: string, files: DiagramFiles): string {
  if (!drawsDiagrams(html)) return inDiagramContext(html);
  return inDiagramContext(
    html
      .replace(FIGURE, (figure) => {
        const key = LIGHT.exec(figure)?.[1];
        const named = key ? drawing(files, key) : undefined;
        if (!key || !named) return figure;
        const caption = /<figcaption\b[^>]*>[\s\S]*?<\/figcaption>/.exec(figure)?.[0] ?? "";
        return `<figure class="blog-diagram">${named}${caption}</figure>`;
      })
      .replace(INLINED, (whole, svg: string) => {
        const key = TITLE_KEY.exec(svg)?.[1];
        const named = key ? drawing(files, key) : undefined;
        return named ? `<figure class="blog-diagram">${named}` : whole;
      }),
  );
}
