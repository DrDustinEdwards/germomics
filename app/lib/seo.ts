// Client-safe SEO helpers: reading time, heading anchors + table of contents, and schema.org
// JSON-LD builders. Pure functions (no server imports) so routes can use them in meta() and
// components alike. JSON-LD mirrors on-page content: BlogPosting for articles, PodcastEpisode
// (+ MediaObject + partOfSeries) for episodes.
import type { Post } from "~/db/schema";
import type { GuestView, Host } from "~/lib/types";
import {
  type ArticleFacts,
  articleDates,
  defineHead,
} from "@drdustinedwards/site-helpers/head";
import { article, faqPage, thing } from "@drdustinedwards/site-helpers/schema";
import { DEFAULT_CARD, SITE_ORIGIN, postalAddressLd, type Address } from "~/lib/site";

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

/**
 * Demote body headings one level (h1->h2, h2->h3, h3->h4) so the page keeps a single h1 (the post
 * title) and body sections become h2, matching the semantic outline. Render-time only; the stored
 * (migrated) body is never modified. Heading ids are derived from text, so they stay stable across
 * the shift and the TOC anchors still resolve.
 */
export function demoteHeadings(html: string): string {
  return html.replace(
    /<(\/?)h([1-3])(\b[^>]*)?>/gi,
    (_m, slash: string, n: string, attrs = "") => `<${slash}h${Number(n) + 1}${attrs}>`,
  );
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
  author: string;
  seriesTitle: string;
  guests?: GuestView[];
  hosts?: Host[];
};

/** schema.org JSON-LD object for a post — BlogPosting (article) or PodcastEpisode. */
export function buildJsonLd({ post, author, seriesTitle, guests = [], hosts = [] }: JsonLdOpts) {
  const url = `${SITE_ORIGIN}/${post.slug}`;
  const image = ogImageFor(post) ?? undefined;
  const description = post.seoDescription ?? post.excerpt ?? stripHtml(post.body).slice(0, 200);
  const datePublished = post.publishedAt ?? post.publishAt ?? undefined;

  if (post.kind === "episode") {
    const { published, modified } = articleDates({ published: datePublished, modified: post.updatedAt });
    return thing("PodcastEpisode", {
      name: post.title,
      url,
      datePublished: published,
      dateModified: modified,
      description,
      image,
      episodeNumber: post.episodeNumber || undefined,
      timeRequired: isoDuration(post.audioDuration),
      associatedMedia: post.audioUrl
        ? {
            "@type": "MediaObject",
            contentUrl: post.audioUrl,
            encodingFormat: post.audioMimeType ?? "audio/mpeg",
            ...(post.audioByteSize ? { contentSize: String(post.audioByteSize) } : {}),
            duration: isoDuration(post.audioDuration),
          }
        : undefined,
      partOfSeries: { "@type": "PodcastSeries", name: seriesTitle, url: `${SITE_ORIGIN}/` },
      // Hosts are the authors/creators of the episode; per-episode guests map to actor.
      author: (hosts.length ? hosts : [{ name: author }]).map((h) => ({
        "@type": "Person",
        name: h.name,
        ...("href" in h && h.href ? { url: h.href } : {}),
      })),
      actor: guests.map((g) => ({ "@type": "Person", name: g.name })),
    });
  }

  return article({
    type: "BlogPosting",
    url,
    headline: post.title,
    description,
    image: image ?? undefined,
    published: datePublished,
    modified: post.updatedAt,
    tags: post.tags ?? [],
    author: { "@type": "Person", name: author },
    publisher: { "@type": "Organization", name: seriesTitle },
  });
}

// ── Site-level + entity JSON-LD (Organization, PodcastSeries, Person, FAQ) ───────

type ShowLike = {
  title: string;
  description: string;
  author: string;
  artwork: string;
  subscribeLinks?: Record<string, string> | null;
};

type SiteLdOpts = { address?: Partial<Address>; sameAs?: readonly string[] };

type SocialHandles = { facebook?: string; twitter?: string; instagram?: string };
export type SocialLink = { platform: string; label: string; url: string };

/** Profile links from social handles (settings social.*), for the footer. Empty handles are skipped. */
export function socialLinks(s: SocialHandles): SocialLink[] {
  const links: SocialLink[] = [];
  if (s.facebook) links.push({ platform: "facebook", label: "Facebook", url: `https://www.facebook.com/${s.facebook}` });
  if (s.twitter) links.push({ platform: "x", label: "X", url: `https://x.com/${s.twitter}` });
  if (s.instagram) links.push({ platform: "instagram", label: "Instagram", url: `https://www.instagram.com/${s.instagram}/` });
  return links;
}

/** The same profiles as schema.org sameAs URLs, so footer and schema stay consistent. */
export function socialSameAs(s: SocialHandles): string[] {
  return socialLinks(s).map((l) => l.url);
}

/** Organization node for the publisher (home + About). Address + sameAs are DB-driven. */
export function buildOrganizationLd(show: ShowLike, opts: SiteLdOpts = {}) {
  return thing("Organization", {
    name: show.title,
    url: `${SITE_ORIGIN}/`,
    description: show.description,
    logo: show.artwork,
    founder: { "@type": "Person", name: show.author },
    address: postalAddressLd(opts.address),
    sameAs: opts.sameAs ? [...opts.sameAs] : undefined,
  });
}

/** PodcastSeries node tying the show to its immutable feed (home). */
export function buildPodcastSeriesLd(show: ShowLike, opts: SiteLdOpts = {}) {
  return thing("PodcastSeries", {
    name: show.title,
    url: `${SITE_ORIGIN}/`,
    description: show.description,
    image: show.artwork,
    webFeed: `${SITE_ORIGIN}/feed/podcast/`,
    author: { "@type": "Person", name: show.author },
    address: postalAddressLd(opts.address),
    sameAs: opts.sameAs ? [...opts.sameAs] : undefined,
  });
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
export function buildPersonLd(author: PersonLd) {
  return thing("Person", {
    name: author.name,
    honorificPrefix: author.honorific,
    url: `${SITE_ORIGIN}/about/${author.slug}`,
    jobTitle: author.jobTitle,
    description: author.bio,
    affiliation: { "@type": "Organization", name: author.affiliation },
    memberOf: { "@type": "Organization", name: author.memberOf },
    alumniOf: author.alumniOf.map((name) => ({ "@type": "Organization", name })),
    knowsAbout: [...author.knowsAbout],
    sameAs: [...author.sameAs],
  });
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

  return faqPage(qa.map(({ q, a }) => ({ question: q, answer: a })));
}

/** True when a post was meaningfully updated after publication (different calendar day). */
export function wasUpdatedAfterPublish(post: Post): boolean {
  if (!post.updatedAt) return false;
  const pub = post.publishedAt ?? post.publishAt;
  if (!pub) return false;
  return post.updatedAt.slice(0, 10) > pub.slice(0, 10);
}

type PageHead = {
  path: string;
  title: string;
  description: string;
  image?: string | null;
  socialTitle?: string;
  type?: "website" | "article" | "profile";
  article?: ArticleFacts;
  pageType?: "CollectionPage";
  breadcrumbs?: Array<{ name: string; path: string }>;
};

// Prelum builds each page's WebPage and BreadcrumbList from these sections; a page whose trail is not its URL (a season,
// an episode under its season) passes its own.
const head = defineHead({
  origin: SITE_ORIGIN,
  siteName: "Germomics",
  suffix: " · Germomics",
  image: DEFAULT_CARD,
  sections: { "/about": "About", "/episodes": "Episodes", "/writing": "Writing", "/data": "Data", "/games": "Games" },
});

/**
 * The head of a public page from Prelum's defineHead: title, description, canonical, Open Graph and Twitter, always on
 * SITE_ORIGIN so a workers.dev copy never claims the page. The show cover is the card when the page has none. A
 * description too long for a search result is cut at a word (the share card keeps it whole), so a page whose
 * description is its own text (About, TXASM) sends one sentence's worth, not the page. The title is passed whole.
 * One canonical path per page: Prelum drops a trailing slash a visitor typed (except on "/"), but the podcast feed's
 * /feed/podcast/ keeps its slash: that URL never changes (CLAUDE.md rule 1).
 */
export function pageHead({ path, ...page }: PageHead) {
  return head({ ...page, path, fullTitle: true, keepTrailingSlash: path === "/feed/podcast/" });
}
