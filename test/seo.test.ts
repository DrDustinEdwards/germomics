import { describe, expect, it } from "vitest";
import type { Post } from "~/db/schema";
import { buildJsonLd, wasUpdatedAfterPublish } from "~/lib/seo";

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

describe("buildJsonLd", () => {
  const base = { author: "Dustin Edwards", seriesTitle: "Germomics" };

  it("describes an article as a BlogPosting with the site author and publisher", () => {
    const ld = buildJsonLd({
      ...base,
      post: post({
        tags: ["cholera", "history"],
        coverImage: "https://img/c.png",
        excerpt: "Short.",
      }),
    });
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
    const d = (over: Partial<Post>) =>
      (buildJsonLd({ ...base, post: post(over) }) as { description: string }).description;
    expect(d({ seoDescription: "SEO", excerpt: "Ex" })).toBe("SEO");
    expect(d({ excerpt: "Ex" })).toBe("Ex");
    expect(d({ bodyHtml: `<p>${"x".repeat(300)}</p><script>bad()</script>` })).toBe(
      "x".repeat(200),
    );
  });

  it("leaves out the image and keywords when there are none, and falls back to the schedule date", () => {
    const ld = buildJsonLd({
      ...base,
      post: post({
        publishedAt: null,
        publishAt: "2030-01-01T00:00:00.000Z",
        updatedAt: undefined,
      }),
    }) as Record<string, unknown>;
    expect(ld).not.toHaveProperty("image");
    expect(ld).not.toHaveProperty("keywords");
    expect(ld.datePublished).toBe("2030-01-01T00:00:00.000Z");
  });
});

describe("wasUpdatedAfterPublish", () => {
  it("is true only when the update falls on a later calendar day than the publish date", () => {
    expect(
      wasUpdatedAfterPublish(
        post({ publishedAt: "2024-01-02T23:59:00.000Z", updatedAt: "2024-01-02 23:59:59" }),
      ),
    ).toBe(false);
    expect(
      wasUpdatedAfterPublish(
        post({ publishedAt: "2024-01-02T00:00:00.000Z", updatedAt: "2024-01-03 00:00:00" }),
      ),
    ).toBe(true);
    expect(
      wasUpdatedAfterPublish(
        post({ publishedAt: "2024-01-05T00:00:00.000Z", updatedAt: "2024-01-03 00:00:00" }),
      ),
    ).toBe(false);
    expect(wasUpdatedAfterPublish(post({ updatedAt: undefined }))).toBe(false);
    expect(wasUpdatedAfterPublish(post({ publishedAt: null, publishAt: null }))).toBe(false);
    expect(
      wasUpdatedAfterPublish(
        post({
          publishedAt: null,
          publishAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-02-01 00:00:00",
        }),
      ),
    ).toBe(true);
  });
});
