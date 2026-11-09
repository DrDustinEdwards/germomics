import { describe, expect, it } from "vitest";
import { episodeContext } from "~/lib/episode-context.server";
import { EPISODE_CONTEXT } from "~/lib/episode-context";
import data from "~/lib/data/datasets.json";

describe("episode context", () => {
  it("previews only the two episodes that have a standalone data page", () => {
    expect(Object.keys(EPISODE_CONTEXT).sort()).toEqual([
      "a-boy-named-flu",
      "confessions-of-a-cholera-girl",
    ]);
    for (const slug of ["on-the-right-taq", "rabies-day-out", "a-sky-full-of-sars"])
      expect(episodeContext(slug)).toBeNull();
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
});
