import { describe, expect, it } from "vitest";
import type { Post } from "~/db/schema";
import {
  buildJsonLd,
  buildOrganizationLd,
  buildPersonLd,
  buildPodcastSeriesLd,
  extractFaqLd,
  headingId,
  readingTime,
  stripHtml,
  tableOfContents,
  wasUpdatedAfterPublish,
} from "~/lib/seo";

// Search and answer engines read these: the schema.org nodes mirror the page, so a wrong field or a
// leaked <script> in a description is seen by every crawler. Heading, outline and anchor behavior
// already pinned in post-render.test.ts is not repeated here.
const ORIGIN = "https://germomics.com";
const post = (over: Partial<Post>): Post =>
  ({
    kind: "article",
    slug: "pump",
    title: "The Pump",
    body: "<p>Body text</p>",
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
  });
});

describe("readingTime", () => {
  it("is about 200 words a minute, never under one minute", () => {
    const words = (n: number) => `<p>${Array.from({ length: n }, () => "w").join(" ")}</p>`;
    expect(readingTime("")).toBe(1);
    expect(readingTime(words(50))).toBe(1);
    expect(readingTime(words(299))).toBe(1);
    expect(readingTime(words(300))).toBe(2);
    expect(readingTime(words(1000))).toBe(5);
    expect(readingTime("<p>" + "w ".repeat(400) + "</p><script>" + "x ".repeat(5000) + "</script>")).toBe(2);
  });
});

describe("headingId", () => {
  it("lowercases, joins words with single dashes, trims them, and caps at 64 characters", () => {
    expect(headingId("The <em>Broad</em> Street Pump!")).toBe("the-broad-street-pump");
    expect(headingId("  --Hello,   World--  ")).toBe("hello-world");
    expect(headingId("Über straße 1854")).toBe("über-straße-1854");
    expect(headingId("a".repeat(100))).toHaveLength(64);
    expect(headingId("!!!")).toBe("");
  });
});

describe("tableOfContents", () => {
  it("skips empty headings and stamps each entry with its level and the same id the anchors use", () => {
    expect(tableOfContents("<H2>One</H2><h3 class='x'>Two <b>b</b></h3><h2> </h2><h4>No</h4>")).toEqual([
      { level: 2, id: "one", text: "One" },
      { level: 3, id: "two-b", text: "Two b" },
    ]);
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
    expect(d({ body: `<p>${"x".repeat(300)}</p><script>bad()</script>` })).toBe("x".repeat(200));
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

describe("extractFaqLd", () => {
  const html = (faq: string) => `<h2>Intro</h2><p>x</p>${faq}<h2>After</h2><h3>Not a question</h3><p>nope</p>`;

  it("reads question and answer pairs from the FAQ section only", () => {
    const ld = extractFaqLd(html("<h2>Frequently asked questions</h2><h3>What is it?</h3><p>A <b>pump</b>.</p><h3>Why?</h3><p>Cholera.</p><p>More.</p>"));
    expect(ld).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        { "@type": "Question", name: "What is it?", acceptedAnswer: { "@type": "Answer", text: "A pump ." } },
        { "@type": "Question", name: "Why?", acceptedAnswer: { "@type": "Answer", text: "Cholera. More." } },
      ],
    });
  });

  it("accepts the short heading, a section running to the end of the body, and skips pairs missing either half", () => {
    const ld = extractFaqLd("<H2 class='x'> FAQ </H2><h3>Q1</h3><p>A1</p><h3>Empty answer</h3><h3>Q3</h3><p>A3</p>") as { mainEntity: { name: string }[] };
    expect(ld.mainEntity.map((q) => q.name)).toEqual(["Q1", "Q3"]);
  });

  it("returns null with no FAQ heading or no usable pairs", () => {
    expect(extractFaqLd("<h2>Questions</h2><h3>Q</h3><p>A</p>")).toBeNull();
    expect(extractFaqLd("<h2>FAQ</h2><p>No questions here</p>")).toBeNull();
    expect(extractFaqLd("<h2>FAQ</h2><h3>Q only</h3>")).toBeNull();
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
