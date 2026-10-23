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
//   ---
//   <p>Body HTML...</p>

import { jsonSource } from "@dustinedwards/site-api/frontmatter";

export type ArticleSource = {
  title: string | null;
  excerpt: string | null;
  tags: string[] | null;
  coverImage: string | null;
  coverAlt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  body: string;
};

const SOURCE = jsonSource({
  title: "text",
  excerpt: "text",
  tags: "list",
  coverImage: "text",
  coverAlt: "text",
  seoTitle: "text",
  seoDescription: "text",
});

type Fields = Omit<ArticleSource, "body">;
const KEYS = ["title", "excerpt", "tags", "coverImage", "coverAlt", "seoTitle", "seoDescription"] as const;

/** Writes only the fields that have a value (not null, empty or an empty list), in a fixed order. */
export function renderSource(post: Fields & { title: string; body: string }): string {
  const values = Object.fromEntries(KEYS.map((k) => [k, post[k] === null || post[k]?.length === 0 ? undefined : post[k]]));
  return SOURCE.write(values, post.body);
}

/** Parses front matter plus body. A key that is absent is null, so a save can leave it alone. */
export function parseSource(source: string): ArticleSource {
  const { values, body } = SOURCE.read(source);
  return { ...(Object.fromEntries(KEYS.map((k) => [k, values[k] ?? null])) as Fields), body };
}
