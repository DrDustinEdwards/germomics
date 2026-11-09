import { describe, expect, it } from "vitest";
import { EPISODE_DIAGRAMS, diagramMarkdown } from "~/lib/episode-diagrams";
import { renderMarkdown } from "~/lib/render.server";
import { stripMermaidFigure } from "~/lib/blog-diagram.server";
import pcr from "../public/blog-diagrams/on-the-right-taq.html?raw";
import cholera from "../public/blog-diagrams/confessions-of-a-cholera-girl.html?raw";
import prion from "../public/blog-diagrams/one-flew-over-the-kuru-nest.html?raw";
import rabies from "../public/blog-diagrams/rabies-day-out.html?raw";
import lepto from "../public/blog-diagrams/hell-on-weils.html?raw";
import diphtheria from "../public/blog-diagrams/antitoxin-togo-please.html?raw";

const FILES: Record<string, string> = {
  "on-the-right-taq": pcr,
  "confessions-of-a-cholera-girl": cholera,
  "one-flew-over-the-kuru-nest": prion,
  "rabies-day-out": rabies,
  "hell-on-weils": lepto,
  "antitoxin-togo-please": diphtheria,
};

describe("the mechanism diagrams", () => {
  it("is one inline figure for each of the six episodes", () => {
    expect(Object.keys(FILES)).toEqual(EPISODE_DIAGRAMS.map((d) => d.slug));
    for (const diagram of EPISODE_DIAGRAMS) {
      const html = FILES[diagram.slug];
      expect(html, diagram.slug).toContain('class="blog-diagram"');
      expect(html, diagram.slug).toContain('role="img"');
      expect(html, diagram.slug).toContain(`<title>${diagram.title}</title>`);
      expect(html, diagram.slug).toContain("<desc>");
      expect(html, diagram.slug).toContain('class="label-primary"');
      expect(html, diagram.slug).toContain('width="680"');
      expect(html, diagram.slug).not.toContain("<script");
    }
  });

  it("drops a :::diagram block instead of emitting a Mermaid image", async () => {
    const markdown = diagramMarkdown(EPISODE_DIAGRAMS[0]);
    const { html } = await renderMarkdown(markdown, async () => []);
    expect(html).not.toContain("diagram-image");
    expect(html).not.toContain("/diagrams/");
    expect(html).not.toContain("<svg");
    const stored = `<figure class="diagram-figure"><p>old</p><img src="/diagrams/old.svg"></figure><p>After.</p>`;
    expect(stripMermaidFigure(stored)).toBe("<p>After.</p>");
  });
});
