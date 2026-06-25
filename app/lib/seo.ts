// Client-safe SEO helpers: reading time, heading anchors + table of contents, and schema.org
// JSON-LD builders. Pure functions (no server imports) so routes can use them in meta() and
// components alike. JSON-LD mirrors on-page content: BlogPosting for articles, PodcastEpisode
// (+ MediaObject + partOfSeries) for episodes.
import type { Post } from "~/db/schema";
import type { GuestView, Host } from "~/lib/types";
import { postalAddressLd, type Address } from "~/lib/site";

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
  hosts?: Host[];
};

/** schema.org JSON-LD object for a post — BlogPosting (article) or PodcastEpisode. */
export function buildJsonLd({ post, origin, author, seriesTitle, guests = [], hosts = [] }: JsonLdOpts) {
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
      dateModified: post.updatedAt ?? datePublished,
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
      // Hosts are the authors/creators of the episode; per-episode guests map to actor.
      author: (hosts.length ? hosts : [{ name: author }]).map((h) => ({
        "@type": "Person",
        name: h.name,
        ...("href" in h && h.href ? { url: h.href } : {}),
      })),
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

// ── Site-level + entity JSON-LD (Organization, PodcastSeries, Person, Breadcrumb, FAQ) ───────

type ShowLike = {
  title: string;
  description: string;
  author: string;
  artwork: string;
  subscribeLinks?: Record<string, string> | null;
};

type SiteLdOpts = { address?: Partial<Address>; sameAs?: readonly string[] };

/** Build profile URLs from social handles (settings social.*). Empty handles are skipped. */
export function socialSameAs(s: { facebook?: string; twitter?: string; instagram?: string }): string[] {
  const urls: string[] = [];
  if (s.facebook) urls.push(`https://www.facebook.com/${s.facebook}`);
  if (s.twitter) urls.push(`https://x.com/${s.twitter}`);
  if (s.instagram) urls.push(`https://www.instagram.com/${s.instagram}/`);
  return urls;
}

/** Organization node for the publisher (home + About). Address + sameAs are DB-driven. */
export function buildOrganizationLd(show: ShowLike, origin: string, opts: SiteLdOpts = {}) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: show.title,
    url: `${origin}/`,
    description: show.description,
    logo: show.artwork,
    founder: { "@type": "Person", name: show.author },
    address: postalAddressLd(opts.address),
    ...(opts.sameAs && opts.sameAs.length ? { sameAs: [...opts.sameAs] } : {}),
  };
}

/** PodcastSeries node tying the show to its immutable feed (home). */
export function buildPodcastSeriesLd(show: ShowLike, origin: string, opts: SiteLdOpts = {}) {
  return {
    "@context": "https://schema.org",
    "@type": "PodcastSeries",
    name: show.title,
    url: `${origin}/`,
    description: show.description,
    image: show.artwork,
    webFeed: `${origin}/feed/podcast/`,
    author: { "@type": "Person", name: show.author },
    address: postalAddressLd(opts.address),
    ...(opts.sameAs && opts.sameAs.length ? { sameAs: [...opts.sameAs] } : {}),
  };
}

/** WebSite node with a SearchAction pointing at /search (home only). */
export function buildWebSiteLd(show: ShowLike, origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: show.title,
    url: `${origin}/`,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${origin}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

type PersonLd = {
  name: string;
  honorific: string;
  slug: string;
  jobTitle: string;
  bio: string;
  affiliation: string;
  memberOf: string;
  alumniOf: readonly string[];
  knowsAbout: readonly string[];
  sameAs: readonly string[];
};

/** Person node for the credentialed author (author bio page). Fields per Vault site-config.md. */
export function buildPersonLd(author: PersonLd, origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: author.name,
    honorificPrefix: author.honorific,
    url: `${origin}/about/${author.slug}`,
    jobTitle: author.jobTitle,
    description: author.bio,
    affiliation: { "@type": "Organization", name: author.affiliation },
    memberOf: { "@type": "Organization", name: author.memberOf },
    alumniOf: author.alumniOf.map((name) => ({ "@type": "Organization", name })),
    knowsAbout: [...author.knowsAbout],
    sameAs: [...author.sameAs],
  };
}

/** BreadcrumbList from an ordered trail of {name, url}. */
export function buildBreadcrumbLd(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

/**
 * FAQPage JSON-LD extracted from a post body that contains an FAQ section — an <h2> reading
 * "FAQ" / "Frequently asked questions" followed by <h3>question</h3> + answer pairs (the shape
 * the AI show-notes generator emits). Returns null when no usable Q&A is found.
 */
export function extractFaqLd(html: string) {
  const heading = html.match(/<h2[^>]*>\s*(?:faq|frequently asked questions?)\s*<\/h2>/i);
  if (!heading || heading.index == null) return null;
  let scope = html.slice(heading.index + heading[0].length);
  const nextH2 = scope.search(/<h2[\s>]/i);
  if (nextH2 !== -1) scope = scope.slice(0, nextH2);

  const qa: Array<{ q: string; a: string }> = [];
  const re = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3[\s>]|$)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(scope))) {
    const q = stripHtml(m[1]);
    const a = stripHtml(m[2]);
    if (q && a) qa.push({ q, a });
  }
  if (!qa.length) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: qa.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

/** True when a post was meaningfully updated after publication (different calendar day). */
export function wasUpdatedAfterPublish(post: Post): boolean {
  if (!post.updatedAt) return false;
  const pub = post.publishedAt ?? post.publishAt;
  if (!pub) return false;
  return post.updatedAt.slice(0, 10) > pub.slice(0, 10);
}
