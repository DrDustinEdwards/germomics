import { describe, expect, it } from "vitest";
import { parseSource, renderSource } from "~/lib/carrel/source";

// The text Carrel edits: front matter of JSON values, then the body. An absent key parses to null so
// a save leaves that field alone. Reading and refusing malformed front matter is site-api's jsonSource,
// tested there; this is germomics' field mapping.
const empty = { title: "", excerpt: null, tags: null, coverImage: null, coverAlt: null, seoTitle: null, seoDescription: null, body: "" };

describe("renderSource", () => {
  it("writes only the fields that have a value, in a fixed order", () => {
    const src = renderSource({ ...empty, title: "T", tags: [], excerpt: "", seoDescription: "D", body: "<p>b</p>" });
    expect(src).toBe('---\ntitle: "T"\nseoDescription: "D"\n---\n<p>b</p>');
  });

  it("round-trips every field through parseSource, quotes and colons included", () => {
    const post = {
      title: 'A "quoted": title',
      excerpt: "One: two",
      tags: ["cholera", "history"],
      coverImage: "https://images.germomics.com/a.png",
      coverAlt: "Alt",
      seoTitle: "SEO",
      seoDescription: "Desc",
      body: "<p>Body\n---\nstill body</p>",
    };
    expect(parseSource(renderSource(post))).toEqual(post);
  });
});

describe("parseSource", () => {
  it("treats text with no front matter as all body", () => {
    expect(parseSource("<p>just body</p>")).toEqual({ ...empty, title: null, body: "<p>just body</p>" });
    expect(parseSource("x\n---\ntitle: \"T\"\n---\n").title).toBeNull();
  });
});
