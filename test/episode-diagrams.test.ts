import { describe, expect, it } from "vitest";
import { buildDiagramModel } from "@drdustinedwards/site-helpers/render/diagram";
import { EPISODE_DIAGRAMS, diagramMarkdown } from "~/lib/episode-diagrams";
import {
  diagramKey,
  diagramsFromAssets,
  inlineBlogDiagrams,
  type DiagramFiles,
} from "~/lib/blog-diagram.server";
import { renderMarkdown } from "~/lib/render.server";
import storedPcr from "./fixtures/pcr-stored-figure.txt?raw";

const RAW: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob("../public/blog-diagrams/*.html", {
      eager: true,
      query: "?raw",
      import: "default",
    }),
  ).map(([path, html]) => [path.replace(/^.*\/|\.html$/g, ""), html as string]),
);
const pcr = RAW["on-the-right-taq"]!;

function files(): DiagramFiles {
  return new Map(
    EPISODE_DIAGRAMS.map((diagram) => [diagramKey(diagram.mermaid), RAW[diagram.file] ?? ""]),
  );
}

describe("the mechanism diagrams", () => {
  it("serves every drawing in public/blog-diagrams from a diagram", () => {
    const served = new Set(EPISODE_DIAGRAMS.map((d) => d.file));
    expect([...served].sort()).toEqual(Object.keys(RAW).sort());
    expect(new Set(EPISODE_DIAGRAMS.map((d) => diagramKey(d.mermaid))).size).toBe(served.size);
  });

  it("keeps each inline figure where the essay's diagram block sits, with its caption", async () => {
    const drawings = files();
    for (const diagram of EPISODE_DIAGRAMS) {
      const key = buildDiagramModel(
        { title: diagram.title, alt: diagram.alt },
        diagram.mermaid,
      ).key;
      expect(diagramKey(diagram.mermaid), diagram.slug).toBe(key);
      expect(RAW[diagram.file], diagram.slug).toContain('class="blog-diagram"');
      expect(RAW[diagram.file], diagram.slug).toContain(`<title>${diagram.title}</title>`);
      expect(RAW[diagram.file], diagram.slug).toContain("<desc>");

      const markdown = `Before the figure.\n\n${diagramMarkdown(diagram)}\n\nAfter the figure.`;
      const { html } = await renderMarkdown(markdown, async () => [], { diagrams: drawings });
      const figureAt = html.indexOf('class="blog-diagram"');
      const beforeAt = html.indexOf("Before the figure.");
      const afterAt = html.indexOf("After the figure.");
      expect(beforeAt, diagram.slug).toBeGreaterThanOrEqual(0);
      expect(figureAt, diagram.slug).toBeGreaterThan(beforeAt);
      expect(afterAt, diagram.slug).toBeGreaterThan(figureAt);
      expect(html, diagram.slug).toContain(`<title id="bd-${key}-title">${diagram.title}</title>`);
      expect(html, diagram.slug).toContain(`<desc id="bd-${key}-desc">`);
      expect(html, diagram.slug).toContain("<figcaption>");
      expect(html, diagram.slug).toContain('<a href="https://');
      expect(html, diagram.slug).not.toContain("diagram-image");
      expect(html, diagram.slug).not.toContain("/diagrams/");
      expect(html, diagram.slug).toMatch(/viewBox="0 0 \d+ \d+"/);
    }
  });

  it("replaces the figure stored on the live PCR page and keeps its caption", () => {
    const html = `<p>Before.</p>${storedPcr}<p>After.</p>`;
    const out = inlineBlogDiagrams(html, files());
    expect(storedPcr).toContain('class="diagram-figure"');
    expect(storedPcr).toContain('class="diagram-image diagram-light"');
    expect(storedPcr).toContain('class="diagram-image diagram-dark"');
    expect(storedPcr).toContain('src="/diagrams/germomics-52d7f101-light.svg"');
    expect(storedPcr).toContain("<figcaption>");
    expect(out.indexOf('class="blog-diagram"')).toBeGreaterThan(out.indexOf("Before."));
    expect(out.indexOf("After.")).toBeGreaterThan(out.indexOf('class="blog-diagram"'));
    expect(out).toContain("<figcaption>");
    expect(out).toContain("Saiki, Gelfand, Stoffel and colleagues, Science (1988)");
    expect(out).not.toContain("diagram-image");
    expect(out).not.toContain("/diagrams/germomics-52d7f101");
  });

  it("follows the asset redirect from a .html address to the drawing", async () => {
    const assets = {
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(init?.redirect).toBe("manual");
        const url = String(input);
        if (url.endsWith(".html")) {
          return new Response(null, {
            status: 307,
            headers: { location: url.replace(/\.html$/, "") },
          });
        }
        if (url.endsWith("/blog-diagrams/on-the-right-taq"))
          return new Response(pcr, { status: 200 });
        return new Response("missing", { status: 404 });
      },
    };
    const drawings = await diagramsFromAssets(assets);
    expect(drawings.get("52d7f101")).toContain("<svg");
    expect(drawings.has("650ac145")).toBe(false);
  });

  it("leaves a stored figure alone when this site has no drawing for its key", () => {
    const stored = `<p>Before.</p><figure class="diagram-figure"><img src="/diagrams/germomics-aaaaaaaa-light.svg" alt="x"><figcaption><p>Keep.</p></figcaption></figure><p>After.</p>`;
    expect(inlineBlogDiagrams(stored, files())).toBe(stored);
  });
});
