import { describe, expect, it } from "vitest";
import { buildDiagramModel } from "@drdustinedwards/site-helpers/render/diagram";
import { EPISODE_DIAGRAMS, diagramMarkdown } from "~/lib/episode-diagrams";
import { diagramKey, inlineBlogDiagrams, type DiagramFiles } from "~/lib/blog-diagram.server";
import { renderMarkdown } from "~/lib/render.server";
import pcr from "../public/blog-diagrams/on-the-right-taq.html?raw";
import cholera from "../public/blog-diagrams/confessions-of-a-cholera-girl.html?raw";
import prion from "../public/blog-diagrams/one-flew-over-the-kuru-nest.html?raw";
import rabies from "../public/blog-diagrams/rabies-day-out.html?raw";
import lepto from "../public/blog-diagrams/hell-on-weils.html?raw";
import diphtheria from "../public/blog-diagrams/antitoxin-togo-please.html?raw";

const RAW: Record<string, string> = {
  "on-the-right-taq": pcr,
  "confessions-of-a-cholera-girl": cholera,
  "one-flew-over-the-kuru-nest": prion,
  "rabies-day-out": rabies,
  "hell-on-weils": lepto,
  "antitoxin-togo-please": diphtheria,
};

function files(): DiagramFiles {
  return new Map(
    EPISODE_DIAGRAMS.map((diagram) => [diagramKey(diagram.mermaid), RAW[diagram.slug] ?? ""]),
  );
}

describe("the mechanism diagrams", () => {
  it("keeps each inline figure where the essay's diagram block sits, with its caption", async () => {
    const drawings = files();
    for (const diagram of EPISODE_DIAGRAMS) {
      const key = buildDiagramModel(
        { title: diagram.title, alt: diagram.alt },
        diagram.mermaid,
      ).key;
      expect(diagramKey(diagram.mermaid), diagram.slug).toBe(key);
      expect(RAW[diagram.slug], diagram.slug).toContain('class="blog-diagram"');
      expect(RAW[diagram.slug], diagram.slug).toContain(`<title>${diagram.title}</title>`);
      expect(RAW[diagram.slug], diagram.slug).toContain("<desc>");

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
      expect(html, diagram.slug).toContain("doi.org");
      expect(html, diagram.slug).not.toContain("diagram-image");
      expect(html, diagram.slug).not.toContain("/diagrams/");
      expect(html, diagram.slug).toContain('width="680"');
    }
  });

  it("leaves a stored figure alone when this site has no drawing for its key", () => {
    const stored = `<p>Before.</p><figure class="diagram-figure"><img src="/diagrams/germomics-aaaaaaaa-light.svg" alt="x"><figcaption><p>Keep.</p></figcaption></figure><p>After.</p>`;
    expect(inlineBlogDiagrams(stored, files())).toBe(stored);
  });
});
