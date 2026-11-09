// The six episode figures. The essay keeps its :::diagram block. Prelum's hash of that Mermaid
// selects the drawing, and the author's caption stays under it. The SVG text lives in a static
// file so the Worker script does not carry it.

const FILES: Record<string, string> = {
  "52d7f101": "/blog-diagrams/on-the-right-taq.html",
  "650ac145": "/blog-diagrams/confessions-of-a-cholera-girl.html",
  bd4cca82: "/blog-diagrams/one-flew-over-the-kuru-nest.html",
  "37c8d7c7": "/blog-diagrams/rabies-day-out.html",
  eddeb2d1: "/blog-diagrams/hell-on-weils.html",
  "56832a80": "/blog-diagrams/antitoxin-togo-please.html",
};

export type DiagramFiles = ReadonlyMap<string, string>;

type Assets = { fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> };

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

/** The six drawings, keyed by the hash of the essay's Mermaid. Missing binding yields an empty map. */
export async function loadBlogDiagrams(env: Env): Promise<DiagramFiles> {
  const assets = (env as Env & { ASSETS?: Assets }).ASSETS;
  const entries = await Promise.all(
    Object.entries(FILES).map(async ([key, path]) => {
      if (!assets) return [key, ""] as const;
      const response = await assets.fetch(new URL(path, "https://assets.local"));
      return [key, response.ok ? await response.text() : ""] as const;
    }),
  );
  return new Map(entries.filter((entry) => entry[1] !== ""));
}

const FIGURE = /<figure\b[^>]*\bclass="diagram-figure"[^>]*>[\s\S]*?<\/figure>/g;
const LIGHT = /\/diagrams\/germomics-([0-9a-f]{8})-light\.svg/;

/**
 * Replace a known Mermaid figure with its inline drawing. The caption rendered from the essay
 * stays. A figure this site does not draw is left as it was.
 */
export function inlineBlogDiagrams(html: string, files: DiagramFiles): string {
  if (!html.includes("diagram-figure")) return html;
  return html.replace(FIGURE, (figure) => {
    const key = LIGHT.exec(figure)?.[1];
    const file = key ? files.get(key) : undefined;
    const svg = file ? /<svg\b[\s\S]*<\/svg>/.exec(file)?.[0] : undefined;
    if (!key || !svg) return figure;
    const caption = /<figcaption\b[^>]*>[\s\S]*?<\/figcaption>/.exec(figure)?.[0] ?? "";
    const titleId = `bd-${key}-title`;
    const descId = `bd-${key}-desc`;
    const named = svg
      .replace("<title>", `<title id="${titleId}">`)
      .replace("<desc>", `<desc id="${descId}">`);
    return (
      `<figure class="blog-diagram" role="img" aria-labelledby="${titleId}" aria-describedby="${descId}">` +
      `${named}${caption}</figure>`
    );
  });
}
