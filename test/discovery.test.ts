import { describe, expect, it } from "vitest";
import type { Post, ShowConfig } from "~/db/schema";
import { buildLlmsFullTxt, buildLlmsTxt } from "~/lib/discovery.server";
import { AUTHOR } from "~/lib/about";

// The machine-readable index files (llms.txt, llms-full.txt, ai.txt) tell AI assistants what to
// read, how to cite it, and what is reserved. The policy lines are the ones that matter most.
const ORIGIN = "https://germomics.com";
const show = { title: "Germomics", description: "A podcast about <b>microbes</b>.", author: "Dustin Edwards", ownerEmail: "owner@example.com" } as ShowConfig;
const post = (over: Partial<Post>): Post =>
  ({ slug: "s", title: "T", bodyHtml: "<p>Body</p>", excerpt: null, seoDescription: null, publishedAt: "2024-03-05T00:00:00.000Z", ...over }) as Post;

describe("buildLlmsTxt", () => {
  it("opens with the show, a plain one-line description, the default intro and the about links", () => {
    const txt = buildLlmsTxt(show, [], [], ORIGIN);
    const lines = txt.split("\n");
    expect(lines[0]).toBe("# Germomics");
    expect(lines[2]).toBe("> A podcast about microbes .");
    expect(txt).toContain("Germomics is a podcast and writing project about microbiology and history by Dustin Edwards.");
    expect(txt).toContain(`- [About Germomics](${ORIGIN}/about): what the project is and how to follow it.`);
    expect(txt).toContain(`- [${AUTHOR.name}, author](${ORIGIN}/about/${AUTHOR.slug}): ${AUTHOR.jobTitle.toLowerCase()}; bio and research.`);
    expect(txt).toContain(`- [Podcast RSS feed](${ORIGIN}/feed/podcast/): the canonical feed.`);
    expect(txt.endsWith("\n")).toBe(true);
  });

  it("uses a supplied intro instead of the default", () => {
    const txt = buildLlmsTxt(show, [], [], ORIGIN, "Custom intro.");
    expect(txt).toContain("Custom intro.");
    expect(txt).not.toContain("curated index of the canonical hubs");
  });

  it("lists episodes and writing with a summary from the excerpt, then the SEO text, then the body", () => {
    const txt = buildLlmsTxt(
      show,
      [post({ slug: "ep", title: "Episode", excerpt: "Ex" })],
      [post({ slug: "a", title: "A", seoDescription: "Seo" }), post({ slug: "b", title: "B", bodyHtml: "<p>From <i>body</i></p>" }), post({ slug: "c", title: "C", bodyHtml: "" })],
      ORIGIN,
    );
    expect(txt).toContain(`## Episodes\n- [Episode](${ORIGIN}/ep): Ex\n`);
    expect(txt).toContain(`- [A](${ORIGIN}/a): Seo`);
    expect(txt).toContain(`- [B](${ORIGIN}/b): From body`);
    expect(txt).toContain(`- [C](${ORIGIN}/c)\n`);
  });

  it("leaves out empty sections, cuts each list at 40 items, and shortens long summaries", () => {
    expect(buildLlmsTxt(show, [], [], ORIGIN)).not.toContain("## Episodes");
    expect(buildLlmsTxt(show, [], [], ORIGIN)).not.toContain("## Writing");
    const many = Array.from({ length: 45 }, (_, i) => post({ slug: `p${i}`, title: `P${i}` }));
    const txt = buildLlmsTxt(show, many, many, ORIGIN);
    expect(txt.match(/- \[P\d+\]\(/g)).toHaveLength(80);
    expect(txt).toContain("(https://germomics.com/p39)");
    expect(txt).not.toContain("(https://germomics.com/p40)");
    const long = buildLlmsTxt(show, [post({ excerpt: "w".repeat(200) })], [], ORIGIN);
    expect(long).toContain(`: ${"w".repeat(159)}…\n`);
  });
});

describe("buildLlmsFullTxt", () => {
  it("includes the about text, the author, and each post with its URL, date and body", () => {
    const txt = buildLlmsFullTxt(show, [post({ slug: "ep", title: "Episode", bodyHtml: "<p>Show <b>notes</b></p>" })], [post({ slug: "a", title: "Essay", bodyHtml: "<p>Essay text</p>" })], ORIGIN);
    expect(txt.startsWith("# Germomics: full content index\n")).toBe(true);
    expect(txt).toContain("It is not exhaustive and omits audio transcripts.");
    expect(txt).toContain("# About Germomics");
    expect(txt).toContain(`# ${AUTHOR.name}`);
    expect(txt).toContain("# Episodes\n\n## Episode\nURL: https://germomics.com/ep\nPublished: March 5, 2024\n\nShow notes\n");
    expect(txt).toContain("# Writing\n\n## Essay\nURL: https://germomics.com/a\nPublished: March 5, 2024\n\nEssay text\n");
  });

  it("falls back to the summary for an empty body, and caps a long body at 6000 characters", () => {
    const txt = buildLlmsFullTxt(show, [post({ title: "Short", bodyHtml: "", excerpt: "Only an excerpt" })], [post({ slug: "long", title: "Long", bodyHtml: `<p>${"w".repeat(7000)}</p>` })], ORIGIN);
    expect(txt).toContain("## Short\nURL: https://germomics.com/s\nPublished: March 5, 2024\n\nOnly an excerpt");
    const body = txt.split("## Long\n")[1].split("\n")[3];
    expect(body).toHaveLength(6000);
    expect(body.endsWith("…")).toBe(true);
  });

  it("omits the Episodes and Writing headings when there are none", () => {
    const txt = buildLlmsFullTxt(show, [], [], ORIGIN);
    expect(txt).not.toContain("# Episodes");
    expect(txt).not.toContain("# Writing");
  });
});
