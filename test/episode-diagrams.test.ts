import { describe, expect, it } from "vitest";
import { buildDiagramModel, diagramAssetPath } from "@drdustinedwards/site-helpers/render/diagram";
import { DIAGRAM_ASSET_PREFIX } from "~/lib/diagram-colors";
import { EPISODE_DIAGRAMS, diagramMarkdown } from "~/lib/episode-diagrams";
import { renderMarkdown } from "~/lib/render.server";
import diagramSizes from "../public/diagrams/sizes.json";

const BANNED = [
  "you should",
  "see a doctor",
  "see a healthcare",
  "post-exposure",
  "wash the wound",
];
const sizes = diagramSizes as Record<string, { width: number; height: number }>;

describe("the proposed mechanism diagrams", () => {
  it("is one Mermaid figure for each of the six episodes", () => {
    expect(EPISODE_DIAGRAMS.map((d) => d.slug)).toEqual([
      "on-the-right-taq",
      "confessions-of-a-cholera-girl",
      "one-flew-over-the-kuru-nest",
      "rabies-day-out",
      "hell-on-weils",
      "antitoxin-togo-please",
    ]);
  });

  it("renders each block through Prelum as a sized light and dark drawing", async () => {
    for (const diagram of EPISODE_DIAGRAMS) {
      const markdown = diagramMarkdown(diagram);
      expect(markdown, diagram.slug).toContain("```mermaid");
      expect(markdown.toLowerCase(), diagram.slug).toContain("schematic");
      expect(markdown, diagram.slug).not.toContain("/games/");
      for (const phrase of BANNED)
        expect(markdown.toLowerCase(), diagram.slug).not.toContain(phrase);

      const model = buildDiagramModel({ title: diagram.title, alt: diagram.alt }, diagram.mermaid);
      const light = diagramAssetPath(model.key, "light", DIAGRAM_ASSET_PREFIX);
      const dark = diagramAssetPath(model.key, "dark", DIAGRAM_ASSET_PREFIX);
      const lightName = light.slice(light.lastIndexOf("/") + 1);
      const darkName = dark.slice(dark.lastIndexOf("/") + 1);
      expect(sizes[lightName]?.width, lightName).toBeGreaterThan(0);
      expect(sizes[darkName]?.height, darkName).toBeGreaterThan(0);

      const { html } = await renderMarkdown(markdown, async () => []);
      expect(html, diagram.slug).toContain('class="diagram-figure"');
      expect(html, diagram.slug).toContain(`>${diagram.title}<`);
      expect(html, diagram.slug).toContain(diagram.alt.replaceAll("'", "&#x27;").slice(0, 40));
      expect(html, diagram.slug).toContain(`class="diagram-image diagram-light"`);
      expect(html, diagram.slug).toContain(`class="diagram-image diagram-dark"`);
      expect(html, diagram.slug).toContain(`src="${light}"`);
      expect(html, diagram.slug).toContain(`src="${dark}"`);
      expect(html, diagram.slug).toContain(`width="${sizes[lightName].width}"`);
      expect(html, diagram.slug).toContain("<figcaption>");
      expect(html, diagram.slug).not.toContain("<pre>");
    }
  }, 60_000);
});
