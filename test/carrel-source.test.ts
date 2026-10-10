import { describe, expect, it } from "vitest";
import { parseSource, renderSource } from "~/lib/carrel/source";

// The text Carrel edits: front matter of JSON values, then the body. An absent key parses to null so
// a save leaves that field alone; a malformed value is refused rather than guessed at.
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

  it("treats an unclosed front matter block as body", () => {
    const src = '---\ntitle: "T"\n<p>no close</p>';
    expect(parseSource(src)).toMatchObject({ title: null, body: src });
  });

  it("accepts CRLF line endings and a block closed at the very end", () => {
    expect(parseSource('---\r\ntitle: "T"\r\n---\r\n<p>b</p>')).toMatchObject({ title: "T", body: "<p>b</p>" });
    expect(parseSource('---\ntitle: "T"\n---')).toMatchObject({ title: "T", body: "" });
  });

  it("ignores unknown keys and lines without a colon", () => {
    const parsed = parseSource('---\nauthor: "someone"\njust a line\n title : "Spaced"\n---\n<p>b</p>');
    expect(parsed.title).toBe("Spaced");
    expect(parsed).not.toHaveProperty("author");
    expect(parsed.body).toBe("<p>b</p>");
  });

  it("refuses a value that is not JSON, naming the key", () => {
    expect(() => parseSource("---\ntitle: bare words\n---\n")).toThrow('Front matter "title" is not valid JSON.');
  });

  it("refuses tags that are not a list of strings", () => {
    expect(() => parseSource('---\ntags: "one"\n---\n')).toThrow('Front matter "tags" must be a list of strings.');
    expect(() => parseSource('---\ntags: ["one", 2]\n---\n')).toThrow('Front matter "tags" must be a list of strings.');
    expect(parseSource('---\ntags: []\n---\n').tags).toEqual([]);
  });

  it("refuses a text field that is not a string", () => {
    expect(() => parseSource("---\nexcerpt: 3\n---\n")).toThrow('Front matter "excerpt" must be a string.');
    expect(() => parseSource('---\ncoverAlt: ["a"]\n---\n')).toThrow('Front matter "coverAlt" must be a string.');
  });
});
