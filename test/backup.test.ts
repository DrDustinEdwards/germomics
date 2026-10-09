import { describe, expect, it } from "vitest";
import { dumpProblems, type DumpSummary } from "../app/lib/backup-checks";

const live = { posts: 40, content_blocks: 25, settings: 60, show_config: 1 };
const good: DumpSummary = {
  tables: [
    { name: "posts", rows: 40 },
    { name: "content_blocks", rows: 25 },
    { name: "settings", rows: 60 },
    { name: "show_config", rows: 1 },
    { name: "user", rows: 1 },
  ],
  excluded: ["session", "verification", "account"],
};

describe("nightly dump checks", () => {
  it("passes a dump that matches the live counts and excludes the credential tables", () => {
    expect(dumpProblems(good, live)).toEqual([]);
  });

  it("fails an empty dump", () => {
    const problems = dumpProblems({ tables: [], excluded: ["session", "verification", "account"] }, live);
    expect(problems).toContain("the dump holds no tables");
    expect(problems).toContain("posts is missing from the dump");
  });

  it("fails a dump where every content table is empty, even if the live counts agree", () => {
    const empty = { posts: 0, content_blocks: 0, settings: 0, show_config: 0 };
    const dump = { ...good, tables: good.tables.map((t) => ({ ...t, rows: 0 })) };
    expect(dumpProblems(dump, empty)).toContain("every content table dumped empty");
  });

  it("fails a dump with a table dumped empty", () => {
    const dump = { ...good, tables: good.tables.map((t) => (t.name === "posts" ? { ...t, rows: 0 } : t)) };
    expect(dumpProblems(dump, live)).toContain("posts dumped empty but has 40 rows");
  });

  it("fails a dump whose count differs from the live table", () => {
    const dump = { ...good, tables: good.tables.map((t) => (t.name === "settings" ? { ...t, rows: 59 } : t)) };
    expect(dumpProblems(dump, live)).toContain("settings dumped 59 rows but has 60");
  });

  it("fails a dump that carries the session table", () => {
    const dump = { ...good, tables: [...good.tables, { name: "session", rows: 3 }] };
    expect(dumpProblems(dump, live)).toContain("session is in the dump but must be excluded");
  });

  it("fails a dump that carries the account table", () => {
    const dump = { ...good, tables: [...good.tables, { name: "account", rows: 1 }] };
    expect(dumpProblems(dump, live)).toContain("account is in the dump but must be excluded");
  });

  it("fails a dump that does not record the exclusions", () => {
    expect(dumpProblems({ ...good, excluded: [] }, live)).toContain("verification is not recorded as excluded");
  });
});
