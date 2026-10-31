import { describe, expect, it } from "vitest";
import { presentExcludes } from "../app/lib/backup-checks";

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
