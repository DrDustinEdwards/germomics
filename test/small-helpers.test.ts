import { describe, expect, it } from "vitest";
import { APPLE_CATEGORIES } from "~/lib/apple-categories";
import { getDataset, listDatasets } from "~/lib/datasets.server";
import { computePeaks } from "~/lib/peaks";
import { slugifyGuest } from "~/lib/posts";
import { DEFAULT_SHOW } from "~/lib/show.server";

// The small pure helpers. Where a hardcoded list mirrors a source of truth, the test derives the
// list and fails both ways, missing and extra (portfolio rule 3.4), with a count so an empty list
// cannot pass (rule 3.3).

describe("slugifyGuest", () => {
  it("lowercases, joins runs of other characters with one dash, and trims dashes", () => {
    expect(slugifyGuest("  Ada  Lovelace ")).toBe("ada-lovelace");
    expect(slugifyGuest("Dr. John O'Neil, Jr.")).toBe("dr-john-o-neil-jr");
    expect(slugifyGuest("Zoë Müller")).toBe("zoë-müller");
    expect(slugifyGuest("--A--")).toBe("a");
    expect(slugifyGuest("!!!")).toBe("");
  });
});

describe("the Apple Podcasts categories", () => {
  it("accepts every category the show ships with, so the editor never rejects its own default", () => {
    expect(DEFAULT_SHOW.categories!.length).toBeGreaterThan(0);
    for (const c of DEFAULT_SHOW.categories!) {
      expect(APPLE_CATEGORIES, c.category).toHaveProperty(c.category);
      if (c.subcategory) expect(APPLE_CATEGORIES[c.category], `${c.category} / ${c.subcategory}`).toContain(c.subcategory);
    }
    expect(APPLE_CATEGORIES).toHaveProperty(DEFAULT_SHOW.appleCategory);
  });
});

describe("the bundled datasets", () => {
  it("lists exactly the datasets getDataset can read, as summaries only", () => {
    const list = listDatasets();
    expect(list.length).toBeGreaterThan(0);
    for (const item of list) {
      expect(Object.keys(item).sort()).toEqual(["kind", "slug", "summary", "title"]);
      expect(getDataset(item.slug)?.title).toBe(item.title);
    }
    expect(getDataset("no-such-dataset")).toBeNull();
  });

  it("has a table whose rows match its columns, for every dataset with one", () => {
    for (const { slug } of listDatasets()) {
      const { table } = getDataset(slug)!;
      if (!table) continue;
      expect(table.rows.length, slug).toBeGreaterThan(0);
      for (const row of table.rows) expect(row, slug).toHaveLength(table.columns.length);
    }
  });
});

describe("computePeaks", () => {
  const f32 = (...v: number[]) => Float32Array.from(v);

  it("returns N integers from 0 to 100, with the loudest slice at 100", () => {
    const samples = Float32Array.from({ length: 4000 }, (_, i) => Math.sin(i / 7) * (i < 2000 ? 0.25 : 0.5));
    const peaks = computePeaks([samples]);
    expect(peaks).toHaveLength(400);
    expect(Math.max(...peaks)).toBe(100);
    expect(peaks.every((p) => Number.isInteger(p) && p >= 0 && p <= 100)).toBe(true);
    expect(peaks[10]).toBeLessThan(peaks[390]);
  });

  it("normalizes against the loudest slice, rounding to whole numbers", () => {
    expect(computePeaks([f32(0.5, 0.25, 0.1, 0)], 4)).toEqual([100, 50, 20, 0]);
    expect(computePeaks([f32(1, 0.3333)], 2)).toEqual([100, 33]);
  });

  it("returns all zeros for silence", () => {
    expect(computePeaks([new Float32Array(1000)], 10)).toEqual(new Array(10).fill(0));
  });

  it("takes the peak of the absolute value, so negative swings count", () => {
    expect(computePeaks([f32(-0.8, 0.2)], 2)).toEqual([100, 25]);
  });

  it("mixes channels down by averaging their absolute values", () => {
    expect(computePeaks([f32(1, 0), f32(-1, 0.5)], 2)).toEqual([100, 25]);
    expect(computePeaks([f32(1), f32(0)], 1)).toEqual([100]);
  });

  it("gives the final slice whatever samples are left over, and zeros when the audio is shorter than N", () => {
    expect(computePeaks([f32(0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.9)], 3)).toEqual([11, 11, 100]);
    expect(computePeaks([f32(0.5, 1)], 4)).toEqual([50, 100, 0, 0]);
  });
});
