// The text Carrel edits for one article: a small front matter block, then the body. The body is
// the site's own sanitized HTML, which is valid markdown, so Carrel's markdown source is a faithful
// copy of what the site stores. Front matter values are JSON, so any title or excerpt round-trips.
// The reader and writer are site-api's jsonSource, given this field list.
//
//   ---
//   title: "Notes on the Broad Street Pump"
//   excerpt: "..."
//   tags: ["cholera","history"]
//   coverImage: "https://images.germomics.com/..."
//   searchTitle: "..."
//   ---
//   <p>Body HTML...</p>
//
// The search fields carry site-api's shared names (searchTitle, description, image, imageAlt, canonical, noindex)
// over the posts columns seo_title, seo_description, og_image, og_image_alt, canonical and noindex. A source written
// before them may still say seoTitle or seoDescription: read as a fallback, never written.

import { jsonSource, splitSource } from "@dustinedwards/site-api/frontmatter";
import type { Post } from "~/db/schema";

export type ArticleSource = {
  title: string | null;
  excerpt: string | null;
  tags: string[] | null;
  coverImage: string | null;
  coverAlt: string | null;
  searchTitle: string | null;
  description: string | null;
  image: string | null;
  imageAlt: string | null;
  canonical: string | null;
  noindex: boolean | null;
  body: string;
};

const SOURCE = jsonSource({
  title: "text",
  excerpt: "text",
  tags: "list",
  coverImage: "text",
  coverAlt: "text",
  searchTitle: "text",
  description: "text",
  image: "text",
  imageAlt: "text",
  canonical: "text",
  noindex: "flag",
  seoTitle: "text",
  seoDescription: "text",
});

type Fields = Omit<ArticleSource, "body">;
const KEYS = ["title", "excerpt", "tags", "coverImage", "coverAlt", "searchTitle", "description", "image", "imageAlt", "canonical", "noindex"] as const;

export type ArticleRow = Pick<Post, "title" | "body" | "excerpt" | "tags" | "coverImage" | "coverAlt" | "seoTitle" | "seoDescription" | "ogImage" | "ogImageAlt"> &
  Partial<Pick<Post, "canonical" | "noindex">>;

/** The row's fields under the source's names (a snapshot from before canonical and noindex lacks them). */
export function sourceOf(post: ArticleRow): Fields & { title: string; body: string } {
  return {
    title: post.title,
    excerpt: post.excerpt,
    tags: post.tags,
    coverImage: post.coverImage,
    coverAlt: post.coverAlt,
    searchTitle: post.seoTitle,
    description: post.seoDescription,
    image: post.ogImage,
    imageAlt: post.ogImageAlt,
    canonical: post.canonical ?? null,
    noindex: post.noindex ?? false,
    body: post.body,
  };
}

/** Writes only the fields that have a value (not null, empty, an empty list or false), in a fixed order. */
export function renderSource(post: ArticleRow): string {
  const fields = sourceOf(post);
  const blank = (v: unknown) => v == null || v === false || v === "" || (Array.isArray(v) && v.length === 0);
  const values = Object.fromEntries(KEYS.map((k) => [k, blank(fields[k]) ? undefined : fields[k]]));
  return SOURCE.write(values, post.body);
}

const SEARCH_KEYS = ["searchTitle", "description", "image", "imageAlt", "canonical"] as const;

/**
 * Parses front matter plus body. A key that is absent is null, so a save can leave it alone, except a search field
 * in a source with front matter: Carrel removes a blank one's key, so there it is "" (or noindex false), a clear.
 */
export function parseSource(source: string): ArticleSource {
  const { values, body } = SOURCE.read(source);
  const { seoTitle, seoDescription, ...rest } = values;
  const fields = Object.fromEntries(KEYS.map((k) => [k, rest[k] ?? null])) as Fields;
  fields.searchTitle ??= seoTitle ?? null;
  fields.description ??= seoDescription ?? null;
  if (splitSource(source).front !== null) {
    for (const k of SEARCH_KEYS) fields[k] ??= "";
    fields.noindex ??= false;
  }
  return { ...fields, body };
}
