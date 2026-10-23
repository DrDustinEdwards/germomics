import { describe, expect, it } from "vitest";
import { addHeadingIds, demoteHeadings, tableOfContents } from "~/lib/seo";

// POST RENDER, pinned.
//
// app/components/content/BodyRenderer.tsx is the single public body renderer for both articles
// and episodes, and everything it actually DOES is these two transforms:
//
//   demoteHeadings(html)  ->  addHeadingIds(...)  ->  dangerouslySetInnerHTML
//
// The component itself is a div and a long Tailwind string, so testing it through a React
// renderer would pin the class list and nothing that matters. These are the functions a
// dependency bump could break silently, and a broken heading id is a table of contents whose
// links all 404 to nowhere on the page.

describe("demoteHeadings", () => {
  it("demotes the ladder by one so the page keeps a single h1", () => {
    expect(demoteHeadings("<h1>a</h1>")).toBe("<h2>a</h2>");
    expect(demoteHeadings("<h2>a</h2>")).toBe("<h3>a</h3>");
    expect(demoteHeadings("<h3>a</h3>")).toBe("<h4>a</h4>");
  });

  it("preserves attributes on the tag it rewrites", () => {
    expect(demoteHeadings('<h2 class="x">a</h2>')).toBe('<h3 class="x">a</h3>');
  });

  it("leaves h4 and non-heading tags alone", () => {
    // The regex only matches h1 to h3. An h4 that became an h5 would break the heading ladder
    // the renderer's styles are written against.
    expect(demoteHeadings("<h4>a</h4>")).toBe("<h4>a</h4>");
    expect(demoteHeadings("<p>a</p>")).toBe("<p>a</p>");
  });
});

describe("addHeadingIds", () => {
  it("injects an id on h2 and h3 so the table of contents can anchor", () => {
    const out = addHeadingIds("<h2>Getting Started</h2>");
    expect(out).toMatch(/<h2 id="[^"]+">Getting Started<\/h2>/);
  });

  it("does not overwrite an id the author already set", () => {
    const html = '<h2 id="mine">Title</h2>';
    expect(addHeadingIds(html)).toBe(html);
  });

  it("leaves headings outside the h2/h3 range alone", () => {
    expect(addHeadingIds("<h4>Sub</h4>")).toBe("<h4>Sub</h4>");
  });

  it("agrees with tableOfContents on the id for the same heading", () => {
    // The two are separate functions over the same text, and a TOC link only works while they
    // agree. This is the assertion that catches them drifting apart.
    const html = "<h2>Chapter One</h2><h3>Section Two</h3>";
    const toc = tableOfContents(html);
    const rendered = addHeadingIds(html);
    expect(toc).toHaveLength(2);
    for (const item of toc) {
      expect(rendered, `no anchor for ${item.text}`).toContain(`id="${item.id}"`);
    }
  });
});

describe("the render pipeline in the order BodyRenderer applies it", () => {
  it("demotes first, then anchors the demoted headings", () => {
    // Order is load-bearing: anchoring first would put ids on the pre-demotion tags and the
    // demotion would then rewrite tags the TOC had already pointed at.
    const out = addHeadingIds(demoteHeadings("<h2>Only Heading</h2>"));
    expect(out).toMatch(/<h3 id="[^"]+">Only Heading<\/h3>/);
  });

  it("passes an empty body through without throwing", () => {
    expect(addHeadingIds(demoteHeadings(""))).toBe("");
  });
});
