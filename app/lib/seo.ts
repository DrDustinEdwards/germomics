// Client-safe SEO helpers: plain text from a rendered body, the body's heading demotion, and schema.org
// JSON-LD builders. Pure functions (no server imports) so routes can use them in meta() and
// components alike. JSON-LD mirrors on-page content: BlogPosting for articles, PodcastEpisode
// (+ MediaObject + partOfSeries) for episodes.
import type { Post } from "~/db/schema";
import type { GuestView, Host } from "~/lib/types";
import type { Dataset, Source } from "~/lib/datasets.server";
import { type ArticleFacts, type HeadImage, defineHead } from "@drdustinedwards/site-helpers/head";
import {
  article,
  dataset,
  organization,
  person,
  podcastEpisode,
  podcastSeries,
  sameAs,
} from "@drdustinedwards/site-helpers/schema";
import { htmlToText } from "@drdustinedwards/site-helpers/text";
import { DEFAULT_CARD, SITE_ADDRESS, SITE_ORIGIN, type Address } from "~/lib/site";

/**
 * Demote a rendered body's headings one level (h1->h2 ... h5->h6) so the page keeps a single h1 (the post
 * title) and its own h2 sections (Hosts, Transcript, Listen), with the body's sections under them as before.
 * Render-time only: the stored HTML keeps Prelum's levels, which the feeds print. Prelum's heading ids are
 * attributes, so they and the table of contents' anchors are untouched.
 */
export function demoteHeadings(html: string): string {
  return html.replace(
    /<(\/?)h([1-5])(\b[^>]*)?>/gi,
    (_m, slash: string, n: string, attrs = "") => `<${slash}h${Number(n) + 1}${attrs}>`,
  );
}

export type TocItem = { level: 2 | 3; id: string; text: string };

/** A post's own share image and its alt text: the social image, else the episode artwork, else the cover. */
export function ogImageFor(post: Post): { src: string; alt: string | null } | null {
  if (post.ogImage) return { src: post.ogImage, alt: post.ogImageAlt };
  if (post.episodeArtwork) return { src: post.episodeArtwork, alt: post.episodeArtworkAlt };
  if (post.coverImage) return { src: post.coverImage, alt: post.coverAlt };
  return null;
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
  // A stored image address may be a site path (/media/<key>); structured data needs an absolute URL.
  const own = ogImageFor(post)?.src;
  const image = own ? new URL(own, SITE_ORIGIN).href : undefined;
  const description =
    post.seoDescription ?? post.excerpt ?? htmlToText(post.bodyHtml ?? "").slice(0, 200);
  const datePublished = post.publishedAt ?? post.publishAt ?? undefined;

  if (post.kind === "episode") {
    return podcastEpisode({
      name: post.title,
      url,
      published: datePublished,
      modified: post.updatedAt,
      description,
      image,
      episodeNumber: post.episodeNumber,
      durationSeconds: post.audioDuration,
      audio: post.audioUrl
        ? { url: post.audioUrl, type: post.audioMimeType, bytes: post.audioByteSize }
        : null,
      series: { name: seriesTitle, url: `${SITE_ORIGIN}/` },
      // Hosts are the authors/creators of the episode; per-episode guests map to actor.
      hosts: hosts.length
        ? hosts.map((h) => ({ name: h.name, url: "href" in h ? h.href : undefined }))
        : [{ name: author }],
      guests,
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
  if (s.facebook)
    links.push({
      platform: "facebook",
      label: "Facebook",
      url: `https://www.facebook.com/${s.facebook}`,
    });
  if (s.twitter) links.push({ platform: "x", label: "X", url: `https://x.com/${s.twitter}` });
  if (s.instagram)
    links.push({
      platform: "instagram",
      label: "Instagram",
      url: `https://www.instagram.com/${s.instagram}/`,
    });
  return links;
}

/** The same profiles as schema.org sameAs URLs, so footer and schema stay consistent. */
export function socialSameAs(s: SocialHandles): string[] {
  return sameAs(socialLinks(s).map((l) => l.url)) ?? [];
}

/** The show's address from the contact.address setting, each missing part from SITE_ADDRESS. */
const addressOf = (a: Partial<Address> = {}): Address => ({
  streetAddress: a.streetAddress ?? SITE_ADDRESS.streetAddress,
  locality: a.locality ?? SITE_ADDRESS.locality,
  region: a.region ?? SITE_ADDRESS.region,
  postalCode: a.postalCode ?? SITE_ADDRESS.postalCode,
  country: a.country ?? SITE_ADDRESS.country,
});

/** Organization node for the publisher (home + About). Address + sameAs are DB-driven. */
export function buildOrganizationLd(show: ShowLike, opts: SiteLdOpts = {}) {
  return organization({
    name: show.title,
    url: `${SITE_ORIGIN}/`,
    description: show.description,
    logo: show.artwork,
    founder: { "@type": "Person", name: show.author },
    address: addressOf(opts.address),
    sameAs: opts.sameAs,
  });
}

/** PodcastSeries node tying the show to its immutable feed (home). */
export function buildPodcastSeriesLd(show: ShowLike, opts: SiteLdOpts = {}) {
  return podcastSeries({
    name: show.title,
    url: `${SITE_ORIGIN}/`,
    description: show.description,
    image: show.artwork,
    webFeed: `${SITE_ORIGIN}/feed/podcast/`,
    author: { "@type": "Person", name: show.author },
    address: addressOf(opts.address),
    sameAs: opts.sameAs,
  });
}

/**
 * A /data page's Dataset node (Prelum's dataset), from what the page shows: its title, its summary as the page reads it,
 * the quantities its chart and map count, the span of its dated points, and the sources it cites. Germomics compiled
 * the page from those sources, so it is the creator and they are the citations.
 */
export function buildDatasetLd(page: Dataset, description: string) {
  const dates = (page.timeline?.series ?? []).flatMap((s) => s.points.map((p) => p.date)).sort();
  const sources = [page.map?.source, page.timeline?.source, page.table?.source].filter(
    (source): source is Source => Boolean(source),
  );
  return dataset({
    name: page.title,
    description,
    url: `${SITE_ORIGIN}/data/${page.slug}`,
    creator: { "@type": "Organization", name: "Germomics", url: `${SITE_ORIGIN}/` },
    isAccessibleForFree: true,
    variableMeasured: [
      ...new Set([
        ...(page.timeline?.series ?? []).map((s) => s.name),
        ...(page.map ? [page.map.valueLabel] : []),
      ]),
    ],
    temporalCoverage: dates.length > 0 ? `${dates[0]}/${dates[dates.length - 1]}` : undefined,
    citation: [...new Map(sources.map((s) => [s.url, s])).values()].map((s) => ({
      "@type": "CreativeWork",
      name: s.label,
      url: s.url,
    })),
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
  return person({
    name: author.name,
    honorificPrefix: author.honorific,
    url: `${SITE_ORIGIN}/about/${author.slug}`,
    jobTitle: author.jobTitle,
    description: author.bio,
    affiliation: author.affiliation,
    memberOf: author.memberOf,
    alumniOf: author.alumniOf,
    knowsAbout: author.knowsAbout,
    sameAs: author.sameAs,
  });
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
  image?: HeadImage | null;
  socialTitle?: string;
  type?: "website" | "article" | "profile";
  article?: ArticleFacts;
  pageType?: "CollectionPage";
  breadcrumbs?: Array<{ name: string; path: string }>;
  canonical?: string;
  noindex?: boolean;
};

// Prelum builds each page's WebPage; a page inside a section passes its trail from lib/trails.ts, the one its visible
// trail (SectionTrail) shows, so the site names no sections here and no page carries a BreadcrumbList it does not show.
const head = defineHead({
  origin: SITE_ORIGIN,
  siteName: "Germomics",
  suffix: " · Germomics",
  image: DEFAULT_CARD,
});

/**
 * The head of a public page from Prelum's defineHead: title, description, canonical, Open Graph and Twitter, always on
 * SITE_ORIGIN so a workers.dev copy never claims the page. The wordmark card is the card when the page has none. A
 * description too long for a search result is cut at a word (the share card keeps it whole), so a page whose
 * description is its own text (About, TXASM) sends one sentence's worth, not the page. The title is passed whole.
 * One canonical path per page: Prelum drops a trailing slash a visitor typed (except on "/"), but the podcast feed's
 * /feed/podcast/ keeps its slash: that URL never changes (CLAUDE.md rule 1).
 */
export function pageHead({ path, ...page }: PageHead) {
  return head({ ...page, path, fullTitle: true, keepTrailingSlash: path === "/feed/podcast/" });
}
