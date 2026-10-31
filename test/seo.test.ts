import { describe, expect, it } from "vitest";
import type { Post } from "~/db/schema";
import {
  buildJsonLd,
  buildOrganizationLd,
  buildPersonLd,
  buildPodcastSeriesLd,
  stripHtml,
  wasUpdatedAfterPublish,
} from "~/lib/seo";

// Search and answer engines read these: the schema.org nodes mirror the page, so a wrong field or a
// leaked <script> in a description is seen by every crawler. Heading, outline and anchor behavior
// already pinned in post-render.test.ts is not repeated here; the reading time, ids, outline and FAQ pairs are
// Prelum's and tested there.
const ORIGIN = "https://germomics.com";
const post = (over: Partial<Post>): Post =>
  ({
    kind: "article",
    slug: "pump",
    title: "The Pump",
    body: "Body text",
    bodyHtml: "<p>Body text</p>",
    excerpt: null,
    seoDescription: null,
    publishedAt: "2024-01-02T00:00:00.000Z",
    publishAt: null,
    updatedAt: "2024-01-02 03:04:05",
    tags: [],
    ogImage: null,
    episodeArtwork: null,
    coverImage: null,
    audioUrl: null,
    audioDuration: null,
    audioByteSize: null,
    audioMimeType: null,
    episodeNumber: null,
    ...over,
  }) as Post;

describe("stripHtml", () => {
  it("drops tags, script and style blocks, and entities, and collapses whitespace", () => {
    expect(stripHtml("<p>One   <b>two</b></p>\n<p>three &amp; four &#39;x&#39;</p>")).toBe("One two three four x");
    expect(stripHtml("a<script>alert(1)\nx</script>b<STYLE>p{}</STYLE>c")).toBe("a b c");
    expect(stripHtml("")).toBe("");
    // Prelum's output: the heading's "#" link is not text, and a hex entity goes like the others.
    expect(stripHtml('<h2 id="a">A &#x26; B<a class="heading-anchor" aria-label="Link to section: A" href="#a">#</a></h2><p>c</p>')).toBe("A B c");
  });
});

describe("buildJsonLd", () => {
  const base = { author: "Dustin Edwards", seriesTitle: "Germomics" };

  it("describes an article as a BlogPosting with the site author and publisher", () => {
    const ld = buildJsonLd({ ...base, post: post({ tags: ["cholera", "history"], coverImage: "https://img/c.png", excerpt: "Short." }) });
    expect(ld).toMatchObject({
      "@type": "BlogPosting",
      headline: "The Pump",
      url: `${ORIGIN}/pump`,
      description: "Short.",
      image: "https://img/c.png",
      author: { "@type": "Person", name: "Dustin Edwards" },
      publisher: { "@type": "Organization", name: "Germomics" },
    });
  });

  it("picks the description from the SEO text, then the excerpt, then the first 200 characters of the body", () => {
    const d = (over: Partial<Post>) => (buildJsonLd({ ...base, post: post(over) }) as { description: string }).description;
    expect(d({ seoDescription: "SEO", excerpt: "Ex" })).toBe("SEO");
    expect(d({ excerpt: "Ex" })).toBe("Ex");
    expect(d({ bodyHtml: `<p>${"x".repeat(300)}</p><script>bad()</script>` })).toBe("x".repeat(200));
  });

  it("leaves out the image and keywords when there are none, and falls back to the schedule date", () => {
    const ld = buildJsonLd({ ...base, post: post({ publishedAt: null, publishAt: "2030-01-01T00:00:00.000Z", updatedAt: undefined }) }) as Record<string, unknown>;
    expect(ld).not.toHaveProperty("image");
    expect(ld).not.toHaveProperty("keywords");
    expect(ld.datePublished).toBe("2030-01-01T00:00:00.000Z");
  });

  it("describes an episode as a PodcastEpisode with its audio, length, series, hosts and guests", () => {
    const ld = buildJsonLd({
      ...base,
      post: post({ kind: "episode", episodeNumber: 3, audioUrl: "https://media/a.mp3", audioDuration: 3725, audioByteSize: 999, audioMimeType: "audio/mp4", episodeArtwork: "https://img/art.png" }),
      hosts: [{ name: "Dustin", href: "https://d.example" }, { name: "Co-host" }],
      guests: [{ name: "Ada", slug: "ada" }],
    });
    expect(ld).toMatchObject({
      "@type": "PodcastEpisode",
      name: "The Pump",
      url: `${ORIGIN}/pump`,
      episodeNumber: 3,
      timeRequired: "PT1H2M5S",
      image: "https://img/art.png",
      associatedMedia: { "@type": "MediaObject", contentUrl: "https://media/a.mp3", encodingFormat: "audio/mp4", contentSize: "999", duration: "PT1H2M5S" },
      partOfSeries: { "@type": "PodcastSeries", name: "Germomics", url: `${ORIGIN}/` },
      author: [{ "@type": "Person", name: "Dustin", url: "https://d.example" }, { "@type": "Person", name: "Co-host" }],
      actor: [{ "@type": "Person", name: "Ada" }],
    });
  });

  it("falls back to the site author, and leaves out audio, episode number and actors when absent", () => {
    const ld = buildJsonLd({ ...base, post: post({ kind: "episode" }) }) as Record<string, unknown>;
    expect(ld.author).toEqual([{ "@type": "Person", name: "Dustin Edwards" }]);
    for (const k of ["associatedMedia", "episodeNumber", "actor"]) expect(ld).not.toHaveProperty(k);
    expect(ld.timeRequired).toBeUndefined();
    const audio = buildJsonLd({ ...base, post: post({ kind: "episode", audioUrl: "https://media/a.mp3" }) }) as { associatedMedia: Record<string, unknown> };
    expect(audio.associatedMedia.encodingFormat).toBe("audio/mpeg");
    expect(audio.associatedMedia).not.toHaveProperty("contentSize");
  });

  it("writes durations as ISO 8601, skipping zero parts", () => {
    const t = (s: number) => (buildJsonLd({ ...base, post: post({ kind: "episode", audioDuration: s }) }) as { timeRequired?: string }).timeRequired;
    expect(t(45)).toBe("PT45S");
    expect(t(60)).toBe("PT1M");
    expect(t(3600)).toBe("PT1H");
    expect(t(3661)).toBe("PT1H1M1S");
    expect(t(0)).toBeUndefined();
    expect(t(-5)).toBeUndefined();
  });
});

describe("site-level JSON-LD", () => {
  const show = { title: "Germomics", description: "About microbes", author: "Dustin Edwards", artwork: "https://img/cover.jpg" };

  it("describes the Organization and the PodcastSeries, with a default address and optional sameAs", () => {
    const org = buildOrganizationLd(show) as Record<string, any>;
    expect(org).toMatchObject({ "@type": "Organization", name: "Germomics", url: `${ORIGIN}/`, logo: show.artwork, founder: { name: "Dustin Edwards" } });
    expect(org.address).toMatchObject({ "@type": "PostalAddress", addressLocality: "Stephenville" });
    expect(org).not.toHaveProperty("sameAs");
    const withLinks = buildOrganizationLd(show, { sameAs: ["https://x.com/t"], address: { locality: "Elsewhere" } }) as Record<string, any>;
    expect(withLinks.sameAs).toEqual(["https://x.com/t"]);
    expect(withLinks.address.addressLocality).toBe("Elsewhere");
    const series = buildPodcastSeriesLd(show, { sameAs: ["https://x.com/t"] }) as Record<string, any>;
    expect(series).toMatchObject({ "@type": "PodcastSeries", webFeed: `${ORIGIN}/feed/podcast/`, image: show.artwork, sameAs: ["https://x.com/t"] });
    expect(buildPodcastSeriesLd(show)).not.toHaveProperty("sameAs");
  });

  it("describes the credentialed author as a Person", () => {
    const person = buildPersonLd(
      { name: "Ada", honorific: "Dr.", slug: "ada", jobTitle: "Professor", bio: "Bio", affiliation: "Uni", memberOf: "Society", alumniOf: ["A", "B"], knowsAbout: ["x"], sameAs: ["https://o.example"] },
    );
    expect(person).toMatchObject({
      "@type": "Person",
      honorificPrefix: "Dr.",
      url: `${ORIGIN}/about/ada`,
      affiliation: { name: "Uni" },
      memberOf: { name: "Society" },
      alumniOf: [{ "@type": "Organization", name: "A" }, { "@type": "Organization", name: "B" }],
      knowsAbout: ["x"],
      sameAs: ["https://o.example"],
    });
  });
});

describe("wasUpdatedAfterPublish", () => {
  it("is true only when the update falls on a later calendar day than the publish date", () => {
    expect(wasUpdatedAfterPublish(post({ publishedAt: "2024-01-02T23:59:00.000Z", updatedAt: "2024-01-02 23:59:59" }))).toBe(false);
    expect(wasUpdatedAfterPublish(post({ publishedAt: "2024-01-02T00:00:00.000Z", updatedAt: "2024-01-03 00:00:00" }))).toBe(true);
    expect(wasUpdatedAfterPublish(post({ publishedAt: "2024-01-05T00:00:00.000Z", updatedAt: "2024-01-03 00:00:00" }))).toBe(false);
    expect(wasUpdatedAfterPublish(post({ updatedAt: undefined }))).toBe(false);
    expect(wasUpdatedAfterPublish(post({ publishedAt: null, publishAt: null }))).toBe(false);
    expect(wasUpdatedAfterPublish(post({ publishedAt: null, publishAt: "2024-01-01T00:00:00.000Z", updatedAt: "2024-02-01 00:00:00" }))).toBe(true);
  });
});
