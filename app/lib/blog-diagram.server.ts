// The six episode figures. The essay keeps its :::diagram block. Prelum's hash of that Mermaid
// selects the drawing, and the author's caption stays under it. The SVG text lives in a static
// file so the Worker script does not carry it. Reading it needs the ASSETS binding in
// wrangler.jsonc. The files are still served to browsers without that binding, and then
// env.ASSETS is missing, so the swap leaves the Mermaid image in place.

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

/** Prelum's diagram key: FNV-1a of template version 1 and the normalized Mermaid source. */
export function diagramKey(source: string): string {
  const normalized = source.replace(/\r\n/g, "\n").replace(/\s+$/, "").replace(/^\n+/, "");
  const input = `1\n${normalized}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

const ASSET_ORIGIN = "https://assets.local";

/**
 * Workers Static Assets' html_handling redirects /name.html to /name. That response is not ok,
 * so reading only the first hop drops every drawing and the Mermaid image is left in place.
 */
async function readAsset(assets: DiagramAssets, path: string): Promise<string> {
  let url = new URL(path, ASSET_ORIGIN);
  for (let hop = 0; hop < 2; hop += 1) {
    // manual: the assets binding applies html_handling, and a followed redirect would leave
    // the binding. A /name.html request is a 307 to /name, which this loop reads next.
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

/** The six drawings, keyed by the hash of the essay's Mermaid. */
export async function diagramsFromAssets(assets: DiagramAssets | undefined): Promise<DiagramFiles> {
  if (!assets) return new Map();
  const entries = await Promise.all(
    Object.entries(FILES).map(async ([key, path]) => [key, await readAsset(assets, path)] as const),
  );
  return new Map(entries.filter((entry) => entry[1] !== ""));
}

/** The six drawings from the Worker's asset binding. */
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

/**
 * Holds each diagram in a reading context of its own, where Capsomer's prose blocks draw it (its --diagram-* tokens,
 * a :::diagram's light and dark images), without making the whole essay one. Idempotent, so a stored render that
 * already has it, or one saved before it, reads the same.
 */
export function inDiagramContext(html: string): string {
  if (!html.includes("diagram")) return html;
  return html.replace(UNWRAPPED, (figure) => `${CONTEXT_OPEN}${figure}</div>`);
}

/** A figure inlined at an earlier render: its key, from its title's id, and the drawing it was given then. */
const INLINED =
  /(<figure class="blog-diagram" role="img" aria-labelledby="bd-([0-9a-f]{8})-title"[^>]*>)<svg\b[\s\S]*?<\/svg>/g;

/** The site's current drawing for a key, its title and description named for the figure's aria references. */
function drawing(files: DiagramFiles, key: string): string | undefined {
  const svg = /<svg\b[\s\S]*<\/svg>/.exec(files.get(key) ?? "")?.[0];
  return svg
    ?.replace("<title>", `<title id="bd-${key}-title">`)
    .replace("<desc>", `<desc id="bd-${key}-desc">`);
}

/** Whether a stored render has a diagram figure that inlineBlogDiagrams draws from the site's files. */
export function drawsDiagrams(html: string): boolean {
  return html.includes("diagram-figure") || html.includes('aria-labelledby="bd-');
}

/**
 * Replace a known Mermaid figure with its inline drawing, and a drawing inlined at an earlier render with the
 * site's current one, so a stored essay always shows the drawing as it is now (its class names match the stylesheet).
 * The caption rendered from the essay stays. A figure this site does not draw is left as it was. Either way it sits in
 * its diagram context.
 */
export function inlineBlogDiagrams(html: string, files: DiagramFiles): string {
  if (!drawsDiagrams(html)) return inDiagramContext(html);
  return inDiagramContext(
    html
      .replace(FIGURE, (figure) => {
        const key = LIGHT.exec(figure)?.[1];
        const named = key ? drawing(files, key) : undefined;
        if (!key || !named) return figure;
        const caption = /<figcaption\b[^>]*>[\s\S]*?<\/figcaption>/.exec(figure)?.[0] ?? "";
        return (
          `<figure class="blog-diagram" role="img" aria-labelledby="bd-${key}-title" aria-describedby="bd-${key}-desc">` +
          `${named}${caption}</figure>`
        );
      })
      .replace(INLINED, (whole, open: string, key: string) => {
        const named = drawing(files, key);
        return named ? `${open}${named}` : whole;
      }),
  );
}
