// The episode figures. The essay keeps its :::diagram block. Prelum's hash of that Mermaid
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
  a9e7c699: "/blog-diagrams/a-boy-named-flu--surface.html",
  "423c9a8d": "/blog-diagrams/a-sky-full-of-sars--spike.html",
  b62309ed: "/blog-diagrams/theres-something-about-typhoid-mary--carrier.html",
  b6d8a8cd: "/blog-diagrams/on-the-right-taq--heat.html",
  "862881f5": "/blog-diagrams/rabies-day-out--window.html",
  "4eba03a1": "/blog-diagrams/its-on-the-syphilis--stages.html",
  "9a54eda7": "/blog-diagrams/confessions-of-a-cholera-girl--rehydration.html",
  b461e289: "/blog-diagrams/antitoxin-togo-please--antitoxin-vaccine.html",
  "94953409": "/blog-diagrams/hell-on-weils--course.html",
  d56f7ad3: "/blog-diagrams/one-flew-over-the-kuru-nest--incubation.html",
  "127ea6bc": "/blog-diagrams/its-on-the-syphilis--cases.html",
  "432c8f43": "/blog-diagrams/antitoxin-togo-please--us-cases.html",
  "2605b9a5": "/blog-diagrams/one-flew-over-the-kuru-nest--deaths.html",
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
