// The text Carrel edits for one article or episode: front matter (one `key: <JSON>` line per field), then the Markdown
// body. The audio and transcript stay in the admin (app/routes/admin.episodes.$id.tsx).
//
//   ---
//   title: "Notes on the Broad Street Pump"
//   excerpt: "..."
//   authors: ["Dustin Edwards"]                (left out: the show's author)
//   tags: ["cholera","history"]
//   featureImage: "/media/..."                 (with featureImageAlt, or featureImageDecorative: true)
//   searchTitle: "..."
//   featured: true
//   sources: [{"type":"book","title":"..."}]
//   episodeNumber: 12                          (an episode's fields, below, only on an episode)
//   chapters: [{"start":0,"title":"Cold open"}]
//   people: [{"slug":"jane-doe","role":"guest"}]
//   ---
//   The body, in Markdown...
//
// A source with front matter is the whole post: a key it leaves out is cleared. One with none is a body alone and
// leaves every field as it was. Key to column: featureImage/featureImageAlt -> cover_image/cover_alt, searchTitle,
// description, image, imageAlt -> seo_title, seo_description, og_image, og_image_alt (@dustinedwards/site-api/frontmatter);
// seoTitle and seoDescription are still read. site-api's jsonSource reads the lines; structured fields arrive as text
// and are parsed and checked here.
import { splitSource } from "@drdustinedwards/site-helpers/frontmatter";
import { jsonSource } from "@dustinedwards/site-api/frontmatter";
import type { Chapter, Guest, Source } from "~/lib/types";

export type PersonRef = { slug: string; role: string | null };

type PostFields = {
  title: string;
  excerpt: string | null;
  /** The post's own credit; null for the show's author (show_config.author). */
  authors: string[] | null;
  series: string | null;
  seriesPart: number | null;
  tags: string[];
  coverImage: string | null;
  coverAlt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImage: string | null;
  ogImageAlt: string | null;
  canonical: string | null;
  noindex: boolean;
  featured: boolean;
  sources: Source[];
};

type EpisodeFields = {
  episodeNumber: number | null;
  seasonNumber: number | null;
  episodeType: "full" | "trailer" | "bonus";
  explicit: boolean;
  episodeArtwork: string | null;
  episodeArtworkAlt: string | null;
  chapters: Chapter[];
  guests: Guest[];
  people: PersonRef[];
};

export type SourcePost = PostFields &
  Partial<EpisodeFields> & { kind: "article" | "episode"; body: string };

/** null when the source had no front matter (a body alone); else every field, cleared ones included. */
export type ParsedSource = {
  body: string;
  post: PostFields | null;
  episode: Partial<EpisodeFields> | null;
};

const POST_KEYS = {
  title: "text",
  excerpt: "text",
  authors: "list",
  series: "text",
  seriesPart: "text",
  tags: "list",
  featureImage: "text",
  featureImageAlt: "text",
  featureImageDecorative: "flag",
  searchTitle: "text",
  description: "text",
  image: "text",
  imageAlt: "text",
  canonical: "text",
  noindex: "flag",
  featured: "flag",
  sources: "text",
} as const;

const EPISODE_KEYS = {
  episodeNumber: "text",
  seasonNumber: "text",
  episodeType: "text",
  explicit: "flag",
  episodeArtwork: "text",
  episodeArtworkAlt: "text",
  chapters: "text",
  guests: "text",
  people: "text",
} as const;

const SOURCE = jsonSource({
  ...POST_KEYS,
  ...EPISODE_KEYS,
  seoTitle: "text",
  seoDescription: "text",
});

export class SourceError extends Error {}

const blank = (v: unknown) =>
  v === null || v === undefined || v === "" || v === false || (Array.isArray(v) && v.length === 0);

export function renderSource(post: SourcePost): string {
  const values: Record<string, unknown> = {
    title: post.title,
    excerpt: post.excerpt,
    authors: post.authors,
    series: post.series,
    seriesPart: post.seriesPart,
    tags: post.tags,
    featureImage: post.coverImage,
    featureImageAlt: post.coverAlt,
    featureImageDecorative: Boolean(post.coverImage) && post.coverAlt === "",
    searchTitle: post.seoTitle,
    description: post.seoDescription,
    image: post.ogImage,
    imageAlt: post.ogImageAlt,
    canonical: post.canonical,
    noindex: post.noindex,
    featured: post.featured,
    sources: post.sources,
  };
  if (post.kind === "episode") {
    for (const key of Object.keys(EPISODE_KEYS) as (keyof EpisodeFields)[]) values[key] = post[key];
    values.episodeType = post.episodeType ?? "full";
  }
  const lines = Object.entries(values)
    .filter(([, v]) => !blank(v))
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  return `---\n${lines.join("\n")}\n---\n${post.body}`;
}

export function parseSource(source: string, kind: "article" | "episode"): ParsedSource {
  let read: ReturnType<typeof SOURCE.read>;
  try {
    read = SOURCE.read(source);
  } catch (err) {
    throw new SourceError(err instanceof Error ? err.message : "The source could not be read.");
  }
  const { values: v, body } = read;
  if (splitSource(source).front === null) return { body, post: null, episode: null };

  const problems: string[] = [];
  const text = (x: string | null | undefined) => (x?.trim() ? x : null);
  const authors = (v.authors ?? []).map((n) => n.trim()).filter(Boolean);
  const part = whole("seriesPart", v.seriesPart, problems);
  if (part === 0) problems.push("seriesPart must be 1 or more.");
  if (v.featureImageDecorative && text(v.featureImageAlt))
    problems.push("featureImageDecorative: a decorative picture takes no alt text.");
  const post: PostFields = {
    title: v.title?.trim() || "Untitled",
    excerpt: text(v.excerpt),
    authors: authors.length ? authors : null,
    series: text(v.series)?.trim() ?? null,
    seriesPart: part || null,
    tags: v.tags ?? [],
    coverImage: text(v.featureImage),
    coverAlt: v.featureImageDecorative ? "" : text(v.featureImageAlt),
    seoTitle: text(v.searchTitle ?? v.seoTitle),
    seoDescription: text(v.description ?? v.seoDescription),
    ogImage: text(v.image),
    ogImageAlt: text(v.imageAlt),
    canonical: text(v.canonical),
    noindex: v.noindex ?? false,
    featured: v.featured ?? false,
    sources: objects<Source>("sources", v.sources, problems, {
      title: "string",
    }),
  };

  const named = (Object.keys(EPISODE_KEYS) as (keyof typeof EPISODE_KEYS)[]).filter(
    (k) => v[k] !== undefined,
  );
  let episode: Partial<EpisodeFields> | null = null;
  if (kind === "article") {
    if (named.length)
      problems.push(`${named.join(", ")}: an episode's fields, and this is an article.`);
  } else {
    const type = v.episodeType?.trim() || "full";
    if (type !== "full" && type !== "trailer" && type !== "bonus")
      problems.push('episodeType must be "full", "trailer" or "bonus".');
    episode = {
      episodeNumber: whole("episodeNumber", v.episodeNumber, problems),
      seasonNumber: whole("seasonNumber", v.seasonNumber, problems),
      episodeType: type as EpisodeFields["episodeType"],
      explicit: v.explicit ?? false,
      episodeArtwork: text(v.episodeArtwork),
      episodeArtworkAlt: text(v.episodeArtworkAlt),
      chapters: objects<Chapter>("chapters", v.chapters, problems, {
        start: "number",
        title: "string",
      }),
      guests: objects<Guest>("guests", v.guests, problems, { name: "string" }),
      people: objects<{ slug: string; role?: string | null }>("people", v.people, problems, {
        slug: "string",
      }).map((p) => ({
        slug: p.slug,
        role: p.role?.trim() || null,
      })),
    };
  }
  if (problems.length) throw new SourceError(problems.join(" "));
  return { body, post, episode };
}

function whole(key: string, raw: string | null | undefined, problems: string[]): number | null {
  if (!raw?.trim()) return null;
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 0) return n;
  problems.push(`${key} must be a whole number.`);
  return null;
}

/** A JSON list of objects, each with the named fields of the named types; [] for none. */
function objects<T>(
  key: string,
  raw: string | null | undefined,
  problems: string[],
  required: Record<string, "string" | "number">,
): T[] {
  if (!raw?.trim()) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
    if (typeof value === "string") value = JSON.parse(value);
  } catch {
    problems.push(`${key}: the value is not valid JSON.`);
    return [];
  }
  const fields = Object.entries(required);
  const ok =
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        fields.every(([f, t]) => typeof item[f] === t),
    );
  if (!ok) {
    problems.push(
      `${key} must be a list of objects, each with ${fields.map(([f, t]) => `"${f}" (a ${t})`).join(" and ")}.`,
    );
    return [];
  }
  return value as T[];
}

const PAGE_SOURCE = jsonSource({ title: "text" });

export function renderPageSource(page: { title: string | null; value: string }): string {
  return PAGE_SOURCE.write({ title: page.title || undefined }, page.value);
}

export function parsePageSource(source: string): {
  title: string | null;
  body: string;
} {
  const { values, body } = PAGE_SOURCE.read(source);
  return { title: values.title ?? null, body };
}
