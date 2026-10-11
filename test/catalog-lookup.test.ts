import { describe, expect, it } from "vitest";
import { getDataset } from "~/lib/datasets.server";
import { getGame } from "~/lib/games.server";

// Slugs come from the URL. Names that exist on every object must not pass as catalog entries.
const INHERITED = ["constructor", "toString", "__proto__", "hasOwnProperty", "valueOf"];

describe("catalog lookups", () => {
  it("knows a real game and dataset", () => {
    expect(getGame("phage-defense")?.slug).toBe("phage-defense");
  });

  it.each(INHERITED)("treats %s as an unknown game and dataset", (name) => {
    expect(getGame(name)).toBeNull();
    expect(getDataset(name)).toBeNull();
  });
});
