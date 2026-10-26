import { describe, expect, it } from "vitest";
import { diffSnapshots, lineDiff } from "~/lib/versions";

// The version history screen: what changed between two saved snapshots of a post. A wrong or
// missing line here means an editor restoring from history picks the wrong version.
describe("diffSnapshots", () => {
  it("lists only the fields that changed, labeled, in the screen's fixed order", () => {
    const a = { title: "Old", slug: "s", status: "draft" as const, body: "<p>a</p>", tags: ["x"] };
    const b = { title: "New", slug: "s", status: "published" as const, body: "<p>b</p>", tags: ["x"] };
    expect(diffSnapshots(a, b)).toEqual([
      { label: "Title", before: "Old", after: "New" },
      { label: "Status", before: "draft", after: "published" },
      { label: "Body", before: "<p>a</p>", after: "<p>b</p>" },
    ]);
  });

  it("returns nothing for identical snapshots, and ignores fields it does not surface", () => {
    expect(diffSnapshots({ title: "T", id: 1, guid: "a" }, { title: "T", id: 2, guid: "b" })).toEqual([]);
  });

  it("shows missing values as empty and numbers as text", () => {
    expect(diffSnapshots({ title: "T" }, { title: "T", episodeNumber: 4, excerpt: "E" })).toEqual([
      { label: "Excerpt", before: "", after: "E" },
      { label: "Episode #", before: "", after: "4" },
    ]);
    expect(diffSnapshots({ excerpt: null }, { excerpt: "" })).toEqual([]);
    expect(diffSnapshots({ episodeNumber: 0 }, { episodeNumber: 1 })).toEqual([{ label: "Episode #", before: "0", after: "1" }]);
  });

  it("joins lists with commas, writing object items as JSON, and objects as JSON", () => {
    const chapters = (title: string) => [{ start: 0, title }];
    expect(diffSnapshots({ tags: ["a", "b"], chapters: chapters("One") }, { tags: ["a", "c"], chapters: chapters("Two") })).toEqual([
      { label: "Tags", before: "a, b", after: "a, c" },
      { label: "Chapters", before: '{"start":0,"title":"One"}', after: '{"start":0,"title":"Two"}' },
    ]);
    expect(diffSnapshots({ tags: [] }, { tags: ["x"] })).toEqual([{ label: "Tags", before: "", after: "x" }]);
  });

  it("surfaces every labeled field", () => {
    const keys = ["title", "slug", "status", "publishAt", "excerpt", "tags", "coverImage", "coverAlt", "ogImage", "seoTitle", "seoDescription", "episodeNumber", "seasonNumber", "episodeType", "audioUrl", "audioDuration", "transcript", "chapters", "guests", "body"];
    const changed = Object.fromEntries(keys.map((k) => [k, "changed"]));
    expect(diffSnapshots({}, changed)).toHaveLength(keys.length);
  });
});

describe("lineDiff", () => {
  it("marks unchanged, added and removed lines in order", () => {
    expect(lineDiff("a\nb\nc", "a\nx\nc")).toEqual([
      { type: "same", text: "a" },
      { type: "del", text: "b" },
      { type: "add", text: "x" },
      { type: "same", text: "c" },
    ]);
  });

  it("reports pure additions and deletions at either end", () => {
    expect(lineDiff("a", "a\nb")).toEqual([{ type: "same", text: "a" }, { type: "add", text: "b" }]);
    expect(lineDiff("a\nb", "b")).toEqual([{ type: "del", text: "a" }, { type: "same", text: "b" }]);
    expect(lineDiff("a", "")).toEqual([{ type: "del", text: "a" }, { type: "add", text: "" }]);
    expect(lineDiff("", "")).toEqual([{ type: "same", text: "" }]);
  });

  it("prefers adding a new first line over deleting the old one when that keeps more lines in common", () => {
    expect(lineDiff("x\ny", "z\nx\ny")).toEqual([{ type: "add", text: "z" }, { type: "same", text: "x" }, { type: "same", text: "y" }]);
  });

  it("deletes the lines left over when the new text ends first, and adds the lines left over when the old ends first", () => {
    expect(lineDiff("a\nb\nc", "a")).toEqual([{ type: "same", text: "a" }, { type: "del", text: "b" }, { type: "del", text: "c" }]);
    expect(lineDiff("a", "a\nb\nc")).toEqual([{ type: "same", text: "a" }, { type: "add", text: "b" }, { type: "add", text: "c" }]);
  });

  it("keeps the longest common run of lines, so a moved line shows as one delete and one add", () => {
    const diff = lineDiff("1\n2\n3\n4", "2\n3\n4\n1");
    expect(diff.filter((d) => d.type === "same").map((d) => d.text)).toEqual(["2", "3", "4"]);
    expect(diff.filter((d) => d.type !== "same")).toEqual([{ type: "del", text: "1" }, { type: "add", text: "1" }]);
  });

  it("rebuilds both texts from its output", () => {
    const a = "one\ntwo\nthree\nfour\nfive";
    const b = "one\n2\nthree\nfive\nsix";
    const diff = lineDiff(a, b);
    expect(diff.filter((d) => d.type !== "add").map((d) => d.text).join("\n")).toBe(a);
    expect(diff.filter((d) => d.type !== "del").map((d) => d.text).join("\n")).toBe(b);
  });
});
