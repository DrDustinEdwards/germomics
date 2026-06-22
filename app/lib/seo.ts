// Client-safe SEO helpers: reading time, heading anchors + table of contents, and schema.org
// JSON-LD builders. Pure functions (no server imports) so routes can use them in meta() and
// components alike. JSON-LD mirrors on-page content: BlogPosting for articles, PodcastEpisode
// (+ MediaObject + partOfSeries) for episodes.
import type { Post } from "~/db/schema";
import type { GuestView } from "~/lib/types";

export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;|&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Minutes to read, ~200 wpm, floor 1. */
export function readingTime(html: string): number {
  const words = stripHtml(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Stable id from heading text (matches addHeadingIds + tableOfContents). */
export function headingId(text: string): string {
  return stripHtml(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** Inject id attributes into h2/h3 so the TOC can anchor-link to them. */
export function addHeadingIds(html: string): string {
  return html.replace(/<(h[23])(\s[^>]*)?>([\s\S]*?)<\/\1>/gi, (m, tag, attrs = "", inner) => {
    if (/\sid=/.test(attrs)) return m;
    return `<${tag}${attrs} id="${headingId(inner)}">${inner}</${tag}>`;
  });
}

export type TocItem = { level: 2 | 3; id: string; text: string };

/** Extract an h2/h3 outline for the article table of contents. */
export function tableOfContents(html: string): TocItem[] {
  const out: TocItem[] = [];
  for (const m of html.matchAll(/<(h[23])(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)) {
    const text = stripHtml(m[2]);
    if (text) out.push({ level: m[1].toLowerCase() === "h2" ? 2 : 3, id: headingId(m[2]), text });
  }
  return out;
}

/** ISO-8601 duration (PT#M#S) for schema.org. */
function isoDuration(totalSeconds?: number | null): string | undefined {
  if (!totalSeconds || totalSeconds <= 0) return undefined;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${s ? `${s}S` : ""}` || "PT0S";
}

export function ogImageFor(post: Post): string | null {
  return post.ogImage ?? post.episodeArtwork ?? post.coverImage ?? null;
}

type JsonLdOpts = {
  post: Post;
  origin: string;
  author: string;
  seriesTitle: string;
  guests?: GuestView[];
};

/** schema.org JSON-LD object for a post — BlogPosting (article) or PodcastEpisode. */
export function buildJsonLd({ post, origin, author, seriesTitle, guests = [] }: JsonLdOpts) {
  const url = `${origin}/${post.slug}`;
  const image = ogImageFor(post);
  const description = post.seoDescription ?? post.excerpt ?? stripHtml(post.body).slice(0, 200);
  const datePublished = post.publishedAt ?? post.publishAt ?? undefined;

  if (post.kind === "episode") {
    return {
      "@context": "https://schema.org",
      "@type": "PodcastEpisode",
      name: post.title,
      url,
      datePublished,
      description,
      ...(image ? { image } : {}),
      ...(post.episodeNumber ? { episodeNumber: post.episodeNumber } : {}),
      timeRequired: isoDuration(post.audioDuration),
      ...(post.audioUrl
        ? {
            associatedMedia: {
              "@type": "MediaObject",
              contentUrl: post.audioUrl,
              encodingFormat: post.audioMimeType ?? "audio/mpeg",
              ...(post.audioByteSize ? { contentSize: String(post.audioByteSize) } : {}),
              duration: isoDuration(post.audioDuration),
            },
          }
        : {}),
      partOfSeries: { "@type": "PodcastSeries", name: seriesTitle, url: `${origin}/` },
      ...(guests.length
        ? { actor: guests.map((g) => ({ "@type": "Person", name: g.name })) }
        : {}),
    };
  }

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    url,
    mainEntityOfPage: url,
    datePublished,
    dateModified: post.updatedAt ?? datePublished,
    description,
    ...(image ? { image } : {}),
    author: { "@type": "Person", name: author },
    publisher: { "@type": "Organization", name: seriesTitle },
    ...((post.tags ?? []).length ? { keywords: (post.tags ?? []).join(", ") } : {}),
  };
}
