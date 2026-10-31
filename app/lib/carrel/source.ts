// The text Carrel edits for one article or episode: a front matter block, one `key: <JSON>` line per field, then the
// body, the Markdown the site stores and renders with Prelum (app/lib/render.server.ts). It is every field of the post
// a writer sets, so Carrel is the only editor (Dustin, 2026-10-29); what stays in the germomics admin is the episode's
// audio and transcript, which are files measured or converted in the browser (app/routes/admin.episodes.$id.tsx).
//
//   ---
//   title: "Notes on the Broad Street Pump"
//   excerpt: "..."
//   tags: ["cholera","history"]
//   coverImage: "https://images.germomics.com/..."
//   searchTitle: "..."
//   featured: true
//   sources: [{"type":"book","title":"..."}]
//   episodeNumber: 12                          (an episode's fields, below, only on an episode)
//   chapters: [{"start":0,"title":"Cold open"}]
//   people: [{"slug":"jane-doe","role":"guest"}]
//   ---
//   The body, in Markdown...
//
// THE WHOLE SET. A source with front matter is the post: a key it leaves out is cleared, as Carrel's post and search
// field boxes clear a blank one by removing its key. A source with no front matter at all is a body alone, and leaves
// every field as it was. `excerpt` is site-api's post field and searchTitle, description, image, imageAlt, canonical
// and noindex its search fields (@dustinedwards/site-api/frontmatter), in the columns seo_title, seo_description,
// og_image, og_image_alt, canonical and noindex; the keys before them, seoTitle and seoDescription, are still read.
//
// READING. site-api's jsonSource reads the lines, given this field list; the structured fields (numbers and lists of
// objects) are read as text, which jsonSource hands back as written, and parsed and checked here.
import { jsonSource, splitSource } from "@dustinedwards/site-api/frontmatter";
import type { Chapter, Guest, KeyMoment, Source } from "~/lib/types";

/** An episode's guest by their People entry (/admin/people), with the role on this episode. */
export type PersonRef = { slug: string; role: string | null };

type PostFields = {
  title: string;
  excerpt: string | null;
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
  keyMoments: KeyMoment[];
  guests: Guest[];
  people: PersonRef[];
};

/** What a post's source holds: its kind decides whether the episode's fields are written. */
export type SourcePost = PostFields & Partial<EpisodeFields> & { kind: "article" | "episode"; body: string };

/** A parsed source: null when it had no front matter (a body alone), else every field, cleared ones included. */
export type ParsedSource = { body: string; post: PostFields | null; episode: Partial<EpisodeFields> | null };

const POST_KEYS = {
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
  keyMoments: "text",
  guests: "text",
  people: "text",
} as const;

const SOURCE = jsonSource({ ...POST_KEYS, ...EPISODE_KEYS, seoTitle: "text", seoDescription: "text" });

/** A source Carrel's writer must fix, every problem named. */
export class SourceError extends Error {}

const blank = (v: unknown) => v === null || v === undefined || v === "" || v === false || (Array.isArray(v) && v.length === 0);

/** The source, writing only the fields that have a value, in a fixed order, and an episode's fields only on one. */
export function renderSource(post: SourcePost): string {
  const values: Record<string, unknown> = {
    title: post.title,
    excerpt: post.excerpt,
    tags: post.tags,
    coverImage: post.coverImage,
    coverAlt: post.coverAlt,
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

/** Parses front matter plus body; refuses, naming every problem, a source that does not fit. */
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
  const post: PostFields = {
    title: v.title?.trim() || "Untitled",
    excerpt: text(v.excerpt),
    tags: v.tags ?? [],
    coverImage: text(v.coverImage),
    coverAlt: text(v.coverAlt),
    seoTitle: text(v.searchTitle ?? v.seoTitle),
    seoDescription: text(v.description ?? v.seoDescription),
    ogImage: text(v.image),
    ogImageAlt: text(v.imageAlt),
    canonical: text(v.canonical),
    noindex: v.noindex ?? false,
    featured: v.featured ?? false,
    sources: objects<Source>("sources", v.sources, problems, { title: "string" }),
  };

  const named = (Object.keys(EPISODE_KEYS) as (keyof typeof EPISODE_KEYS)[]).filter((k) => v[k] !== undefined);
  let episode: Partial<EpisodeFields> | null = null;
  if (kind === "article") {
    if (named.length) problems.push(`${named.join(", ")}: an episode's fields, and this is an article.`);
  } else {
    const type = v.episodeType?.trim() || "full";
    if (type !== "full" && type !== "trailer" && type !== "bonus") problems.push('episodeType must be "full", "trailer" or "bonus".');
    episode = {
      episodeNumber: whole("episodeNumber", v.episodeNumber, problems),
      seasonNumber: whole("seasonNumber", v.seasonNumber, problems),
      episodeType: type as EpisodeFields["episodeType"],
      explicit: v.explicit ?? false,
      episodeArtwork: text(v.episodeArtwork),
      episodeArtworkAlt: text(v.episodeArtworkAlt),
      chapters: objects<Chapter>("chapters", v.chapters, problems, { start: "number", title: "string" }),
      keyMoments: objects<KeyMoment>("keyMoments", v.keyMoments, problems, { seconds: "number", label: "string" }),
      guests: objects<Guest>("guests", v.guests, problems, { name: "string" }),
      people: objects<{ slug: string; role?: string | null }>("people", v.people, problems, { slug: "string" }).map((p) => ({
        slug: p.slug,
        role: p.role?.trim() || null,
      })),
    };
  }
  if (problems.length) throw new SourceError(problems.join(" "));
  return { body, post, episode };
}

/** A whole number written as JSON (or as text), or null for none. */
function whole(key: string, raw: string | null | undefined, problems: string[]): number | null {
  if (!raw?.trim()) return null;
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 0) return n;
  problems.push(`${key} must be a whole number.`);
  return null;
}

/** A JSON list of objects, each with the named fields of the named types; [] for none. */
function objects<T>(key: string, raw: string | null | undefined, problems: string[], required: Record<string, "string" | "number">): T[] {
  if (!raw?.trim()) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
    // A list written as a JSON string (quoted) is read the same.
    if (typeof value === "string") value = JSON.parse(value);
  } catch {
    problems.push(`${key}: the value is not valid JSON.`);
    return [];
  }
  const fields = Object.entries(required);
  const ok =
    Array.isArray(value) &&
    value.every((item) => item && typeof item === "object" && !Array.isArray(item) && fields.every(([f, t]) => typeof item[f] === t));
  if (!ok) {
    problems.push(`${key} must be a list of objects, each with ${fields.map(([f, t]) => `"${f}" (a ${t})`).join(" and ")}.`);
    return [];
  }
  return value as T[];
}

const PAGE_SOURCE = jsonSource({ title: "text" });

/** A page's source: its title, then its Markdown. */
export function renderPageSource(page: { title: string | null; value: string }): string {
  return PAGE_SOURCE.write({ title: page.title || undefined }, page.value);
}

/** A page's title (null when the source leaves it out) and Markdown. */
export function parsePageSource(source: string): { title: string | null; body: string } {
  const { values, body } = PAGE_SOURCE.read(source);
  return { title: values.title ?? null, body };
}
