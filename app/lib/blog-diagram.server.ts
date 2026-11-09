// The six mechanism figures, read from static files so the Worker script does not carry the SVG.
// Episode pages inline the file. An essay's old :::diagram block is not drawn again.

const FILES: Record<string, string> = {
  "on-the-right-taq": "/blog-diagrams/on-the-right-taq.html",
  "confessions-of-a-cholera-girl": "/blog-diagrams/confessions-of-a-cholera-girl.html",
  "one-flew-over-the-kuru-nest": "/blog-diagrams/one-flew-over-the-kuru-nest.html",
  "rabies-day-out": "/blog-diagrams/rabies-day-out.html",
  "hell-on-weils": "/blog-diagrams/hell-on-weils.html",
  "antitoxin-togo-please": "/blog-diagrams/antitoxin-togo-please.html",
};

type Assets = { fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> };

/** The inline figure for an episode slug, or null when this episode has none. */
export async function blogDiagram(env: Env, slug: string): Promise<string | null> {
  const path = FILES[slug];
  if (!path) return null;
  const assets = (env as Env & { ASSETS?: Assets }).ASSETS;
  if (!assets) return null;
  const response = await assets.fetch(new URL(path, "https://assets.local"));
  if (!response.ok) return null;
  return response.text();
}

/** Stored HTML from the Mermaid drawings, removed once the page supplies its own figure. */
export function stripMermaidFigure(html: string): string {
  return html.replace(/<figure class="diagram-figure">[\s\S]*?<\/figure>/g, "");
}
