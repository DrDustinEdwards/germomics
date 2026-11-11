import { describe, expect, it } from "vitest";
import { APPLE_CATEGORIES } from "~/lib/apple-categories";
import { getDataset, listDatasets } from "~/lib/datasets.server";
import { DEFAULT_SHOW } from "~/lib/show.server";

// The small pure helpers. Where a hardcoded list mirrors a source of truth, the test derives the
// list and fails both ways, missing and extra (portfolio rule 3.4), with a count so an empty list
// cannot pass (rule 3.3).

describe("the Apple Podcasts categories", () => {
  it("accepts every category the show ships with, so the editor never rejects its own default", () => {
    expect(DEFAULT_SHOW.categories!.length).toBeGreaterThan(0);
    for (const c of DEFAULT_SHOW.categories!) {
      expect(APPLE_CATEGORIES, c.category).toHaveProperty(c.category);
      if (c.subcategory)
        expect(APPLE_CATEGORIES[c.category], `${c.category} / ${c.subcategory}`).toContain(
          c.subcategory,
        );
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
