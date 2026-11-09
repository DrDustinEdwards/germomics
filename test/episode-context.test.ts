import { describe, expect, it } from "vitest";
import { episodeContext } from "~/lib/episode-context.server";
import { EPISODE_CONTEXT, type Schematic } from "~/lib/episode-context";
import data from "~/lib/data/datasets.json";

const WITH_CONTEXT = [
  "on-the-right-taq",
  "confessions-of-a-cholera-girl",
  "one-flew-over-the-kuru-nest",
  "a-boy-named-flu",
  "rabies-day-out",
  "hell-on-weils",
  "antitoxin-togo-please",
] as const;

function schematics(): Schematic[] {
  return Object.values(EPISODE_CONTEXT)
    .map((spec) => spec.schematic)
    .filter((s): s is Schematic => s !== undefined);
}

describe("episode context", () => {
  it("covers the priority episodes and no others", () => {
    expect(Object.keys(EPISODE_CONTEXT).sort()).toEqual([...WITH_CONTEXT].sort());
    for (const slug of [
      "a-sky-full-of-sars",
      "its-on-the-syphilis",
      "theres-something-about-typhoid-mary",
    ])
      expect(episodeContext(slug)).toBeNull();
  });

  it("gives each priority episode the figure it was chosen for", () => {
    expect(episodeContext("on-the-right-taq")?.schematic?.id).toBe("pcr-cycle");
    expect(episodeContext("on-the-right-taq")?.preview).toBeNull();
    expect(episodeContext("confessions-of-a-cholera-girl")?.schematic?.id).toBe("cholera-toxin");
    expect(episodeContext("confessions-of-a-cholera-girl")?.preview?.id).toBe(
      "cholera-deaths-preview",
    );
    expect(episodeContext("one-flew-over-the-kuru-nest")?.schematic?.id).toBe("prion-templating");
    expect(episodeContext("a-boy-named-flu")?.preview?.id).toBe("influenza-deaths-preview");
    expect(episodeContext("a-boy-named-flu")?.schematic).toBeNull();
    expect(episodeContext("rabies-day-out")?.schematic?.id).toBe("rabies-spread");
    expect(episodeContext("hell-on-weils")?.schematic?.id).toBe("leptospira-cycle");
    expect(episodeContext("antitoxin-togo-please")?.schematic?.id).toBe("diphtheria-phage");
  });

  it("draws the death series only, and says what that line is not", () => {
    const bundle = data as unknown as Record<
      string,
      { timelines: { alt: string; yLabel: string; points: { value: number }[] }[] }
    >;
    const cholera = episodeContext("confessions-of-a-cholera-girl")!.preview!;
    const flu = episodeContext("a-boy-named-flu")!.preview!;
    const choleraSeries = bundle["cholera-soho-1854"].timelines[1];
    const fluSeries = bundle["influenza-1918"].timelines[0];
    expect(choleraSeries.yLabel).toBe("Deaths");
    expect(fluSeries.yLabel).toBe("Deaths");
    expect(cholera.alt).toBe(choleraSeries.alt);
    expect(flu.alt).toBe(fluSeries.alt);
    expect(cholera.alt).toContain("127");
    expect(cholera.alt).not.toContain("143");
    expect(flu.alt).toContain("2,651");
    expect(flu.alt).not.toContain("per 1,000");
    expect(cholera.href).toBe("/data/cholera-soho-1854");
    expect(flu.href).toBe("/data/influenza-1918");
    expect(cholera.limits).toContain("578");
    expect(cholera.limits).toContain("616");
    expect(cholera.limits).toContain("not the map");
    expect(cholera.limits).toContain("not evidence");
    expect(flu.limits).toContain("not cases");
    for (const preview of [cholera, flu]) {
      expect(preview.svg).toContain("enarratio-sparkline");
      expect(preview.svg).not.toContain("pump");
      expect(preview.svg).not.toContain("<table");
      expect(preview.source.href.startsWith("https://")).toBe(true);
    }
  });

  it("keeps every schematic a labeled sequence with sources, and off the clinic", () => {
    const figures = schematics();
    expect(figures.length).toBe(6);
    const banned = [
      "you should",
      "see a doctor",
      "see a healthcare",
      "post-exposure",
      "wash the wound",
    ];
    for (const figure of figures) {
      expect(figure.steps.length).toBeGreaterThanOrEqual(3);
      expect(figure.caption.toLowerCase()).toContain("schematic");
      expect(figure.limits.length).toBeGreaterThan(40);
      expect(figure.sources.length).toBeGreaterThanOrEqual(3);
      const text = [figure.caption, figure.limits, ...figure.steps.map((s) => s.detail)]
        .join(" ")
        .toLowerCase();
      for (const phrase of banned) expect(text, figure.id).not.toContain(phrase);
      for (const source of figure.sources) {
        expect(source.href.startsWith("https://"), source.href).toBe(true);
        expect(new URL(source.href).protocol).toBe("https:");
      }
    }
    const joined = figures.flatMap((f) => f.links.map((l) => l.href)).join(" ");
    expect(joined).toContain("/antitoxin-togo-please#diphtheria-phage");
    expect(joined).toContain("/confessions-of-a-cholera-girl#cholera-toxin");
    expect(joined).not.toContain("/games/");
  });
});
