// The text Carrel edits for one article: a small front matter block, then the body. The body is
// the site's own sanitized HTML, which is valid markdown, so Carrel's markdown source is a faithful
// copy of what the site stores. Front matter values are JSON, so any title or excerpt round-trips.
//
//   ---
//   title: "Notes on the Broad Street Pump"
//   excerpt: "..."
//   tags: ["cholera","history"]
//   coverImage: "https://images.germomics.com/..."
//   ---
//   <p>Body HTML...</p>

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

const KEYS = ["title", "excerpt", "tags", "coverImage", "coverAlt", "seoTitle", "seoDescription"] as const;

export function renderSource(post: {
  title: string;
  excerpt: string | null;
  tags: string[] | null;
  coverImage: string | null;
  coverAlt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  body: string;
}): string {
  const lines = KEYS.flatMap((k) => {
    const v = post[k];
    if (v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) return [];
    return [`${k}: ${JSON.stringify(v)}`];
  });
  return `---\n${lines.join("\n")}\n---\n${post.body}`;
}

/** Parses front matter plus body. A key that is absent is null, so a save can leave it alone. */
export function parseSource(source: string): ArticleSource {
  const out: ArticleSource = {
    title: null,
    excerpt: null,
    tags: null,
    coverImage: null,
    coverAlt: null,
    seoTitle: null,
    seoDescription: null,
    body: source,
  };
  const normalized = source.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) return out;
  const end = normalized.indexOf("\n---\n", 3);
  const close = end === -1 && normalized.endsWith("\n---") ? normalized.length - 4 : end;
  if (close === -1) return out;
  const header = normalized.slice(4, close);
  out.body = normalized.slice(close + 5);
  for (const line of header.split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim() as (typeof KEYS)[number];
    if (!KEYS.includes(key)) continue;
    let value: unknown;
    try {
      value = JSON.parse(line.slice(colon + 1).trim());
    } catch {
      throw new Error(`Front matter "${key}" is not valid JSON.`);
    }
    if (key === "tags") {
      if (!Array.isArray(value) || !value.every((t) => typeof t === "string")) {
        throw new Error('Front matter "tags" must be a list of strings.');
      }
      out.tags = value;
    } else if (typeof value === "string") {
      out[key] = value;
    } else {
      throw new Error(`Front matter "${key}" must be a string.`);
    }
  }
  return out;
}
