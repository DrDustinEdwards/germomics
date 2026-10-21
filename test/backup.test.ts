import { describe, expect, it } from "vitest";
import { presentExcludes, siteProblems } from "../app/lib/backup-checks";

// d1-dump tests its standard checks (empty, excluded present, required missing); these are germomics' own.
const live = { posts: 40, content_blocks: 25, settings: 60, show_config: 1 };
const good = {
  tables: [
    { name: "posts", rows: 40 },
    { name: "content_blocks", rows: 25 },
    { name: "settings", rows: 60 },
    { name: "show_config", rows: 1 },
    { name: "user", rows: 1 },
  ],
};

describe("germomics' dump checks", () => {
  it("passes a dump that matches the live counts", () => {
    expect(siteProblems(good, live)).toEqual([]);
  });

  it("fails a dump where every content table is empty, even if the live counts agree", () => {
    const empty = { posts: 0, content_blocks: 0, settings: 0, show_config: 0 };
    const dump = { tables: good.tables.map((t) => ({ ...t, rows: 0 })) };
    expect(siteProblems(dump, empty)).toContain("every content table dumped empty");
  });

  it("fails a dump whose count differs from the live table", () => {
    const dump = { tables: good.tables.map((t) => (t.name === "settings" ? { ...t, rows: 59 } : t)) };
    expect(siteProblems(dump, live)).toContain("settings dumped 59 rows but has 60");
  });

  it("fails a dump that carries a credential table even when nothing was excluded", () => {
    const dump = { tables: [...good.tables, { name: "session", rows: 1 }] };
    expect(siteProblems(dump, live)).toContain("session is in the dump but must be excluded");
  });
});

describe("which credential tables to exclude", () => {
  it("excludes only the ones that exist, so d1-dump does not fail on a missing name", () => {
    expect(presentExcludes(["posts", "user", "session", "account", "verification"])).toEqual([
      "session",
      "verification",
      "account",
    ]);
    expect(presentExcludes(["posts", "account"])).toEqual(["account"]);
    expect(presentExcludes(["posts", "content_blocks", "settings", "show_config"])).toEqual([]);
  });
});
