import { describe, expect, it } from "vitest";
import { presentExcludes, siteProblems } from "../app/lib/backup-checks";

// d1-dump tests its standard checks (empty, excluded present, counted tables missing or off their live count).
describe("germomics' dump check", () => {
  it("fails a dump that carries a credential table even when nothing was excluded", () => {
    expect(siteProblems({ tables: [{ name: "posts" }] })).toEqual([]);
    expect(siteProblems({ tables: [{ name: "posts" }, { name: "session" }] })).toEqual(["session is in the dump but must be excluded"]);
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
