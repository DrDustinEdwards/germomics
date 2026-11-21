import { describe, expect, it } from "vitest";
import { parseSource, renderSource, SourceError, type SourcePost } from "~/lib/carrel/source";

// The text Carrel edits: front matter of JSON values, then the body. Reading malformed front matter is site-api's
// jsonSource, tested there; this is germomics' field mapping, the structured fields it parses itself, and the rule that
// a source with front matter is the whole post.
const article: SourcePost = {
  kind: "article",
  title: 'A "quoted": title',
  excerpt: "One: two",
  authors: ["A. Author"],
  series: "Cholera",
  seriesPart: 2,
  tags: ["cholera", "history"],
  coverImage: "/media/a.png",
  coverAlt: "Alt",
  seoTitle: "SEO",
  seoDescription: "Desc",
  ogImage: "/media/og.png",
  ogImageAlt: "OG",
  canonical: "https://example.com/elsewhere",
  noindex: true,
  featured: true,
  sources: [{ type: "book", title: "Sample Book", url: "https://example.com/book" }],
  body: "Body\n---\nstill body",
};

describe("the source", () => {
  it("round-trips every field of an episode, its structured fields included, under site-api's search field names", () => {
    const episode: SourcePost = {
      ...article,
      kind: "episode",
      episodeNumber: 12,
      seasonNumber: 2,
      episodeType: "bonus",
      explicit: true,
      episodeArtwork: "/media/ep.png",
      episodeArtworkAlt: "Art",
      chapters: [{ start: 0, title: "Cold open" }],
      guests: [{ name: "Sample Guest" }],
      people: [{ slug: "sample-person", role: "guest" }],
    };
    const source = renderSource(episode);
    expect(source).toContain('searchTitle: "SEO"\ndescription: "Desc"\nimage: ');
    const { body, post, episode: fields } = parseSource(source, "episode");
    expect({ kind: "episode", body, ...post, ...fields }).toEqual(episode);
    // An article's source has no episode fields, and refuses them.
    expect(renderSource(article)).not.toContain("episodeType");
    expect(() => parseSource(source, "article")).toThrow(SourceError);
  });

  it("clears what front matter leaves out, leaves every field alone without any, and names each problem", () => {
    expect(parseSource('---\ntitle: "T"\nseoTitle: "Old key"\n---\nx', "article").post).toEqual({
      title: "T",
      excerpt: null,
      authors: null,
      series: null,
      seriesPart: null,
      tags: [],
      coverImage: null,
      coverAlt: null,
      seoTitle: "Old key",
      seoDescription: null,
      ogImage: null,
      ogImageAlt: null,
      canonical: null,
      noindex: false,
      featured: false,
      sources: [],
    });
    expect(parseSource("just a body", "episode")).toEqual({
      body: "just a body",
      post: null,
      episode: null,
    });
    expect(() =>
      parseSource('---\nepisodeNumber: 1.5\nchapters: [{"title":"no start"}]\n---\n', "episode"),
    ).toThrow(/episodeNumber must be a whole number\. chapters must be a list of objects/);
  });

  it("writes a decorative feature image as an empty alt, and refuses one that also has alt text", () => {
    const decorative = { ...article, coverAlt: "" };
    const source = renderSource(decorative);
    expect(source).toContain('featureImage: "/media/a.png"\nfeatureImageDecorative: true');
    expect(source).not.toContain("featureImageAlt");
    expect(parseSource(source, "article").post).toMatchObject({
      coverImage: "/media/a.png",
      coverAlt: "",
    });
    expect(() =>
      parseSource(
        '---\nfeatureImage: "/a.png"\nfeatureImageAlt: "x"\nfeatureImageDecorative: true\n---\n',
        "article",
      ),
    ).toThrow(/decorative picture takes no alt/);
  });
});
