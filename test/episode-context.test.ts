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

  it("draws the death series and says so in a sentence", () => {
    const bundle = data as unknown as Record<
      string,
      { timelines: { yLabel: string; points: { value: number }[] }[] }
    >;
    const cholera = episodeContext("confessions-of-a-cholera-girl")!.preview!;
    const flu = episodeContext("a-boy-named-flu")!.preview!;
    const choleraSeries = bundle["cholera-soho-1854"].timelines[1];
    const fluSeries = bundle["influenza-1918"].timelines[0];
    const peak = (points: { value: number }[]) => Math.max(...points.map((p) => p.value));

    expect(choleraSeries.yLabel).toBe("Deaths");
    expect(fluSeries.yLabel).toBe("Deaths");
    expect(peak(choleraSeries.points)).toBe(127);
    expect(peak(fluSeries.points)).toBe(2651);
    expect(cholera.summary).toContain("127");
    expect(cholera.summary).not.toContain("143");
    expect(flu.summary).toContain("2,651");
    expect(flu.summary).not.toContain("per 1,000");
    expect(cholera.href).toBe("/data/cholera-soho-1854");
    expect(flu.href).toBe("/data/influenza-1918");
    expect(cholera.link).toBe("Snow's map and the full numbers");
    expect(flu.link).toBe("The three waves, week by week");
    expect(cholera.source.href).toBe("https://archive.org/details/b28985266");
    expect(flu.source.href).toBe("https://archive.org/details/sid14156800");

    for (const preview of [cholera, flu]) {
      const prose = `${preview.heading} ${preview.summary} ${preview.link} ${preview.source.label}`;
      expect(prose).not.toMatch(/it is not|the line above|not the map|not evidence|not cases/i);
      expect(prose).not.toContain(";");
      expect(preview.svg).toContain("enarratio-sparkline");
      expect(preview.svg).toContain(preview.summary);
      expect(preview.svg).not.toContain("pump");
      expect(preview.svg).not.toContain("<table");
    }
  });
});
