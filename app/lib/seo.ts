// Client-safe SEO helpers (no server imports, so meta() and components can use them). JSON-LD mirrors on-page content.
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

export type TocItem = { level: 2 | 3; id: string; text: string };

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

export function buildJsonLd({ post, author, seriesTitle, guests = [], hosts = [] }: JsonLdOpts) {
  const url = `${SITE_ORIGIN}/${post.slug}`;
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

export function socialSameAs(s: SocialHandles): string[] {
  return sameAs(socialLinks(s).map((l) => l.url)) ?? [];
}

const addressOf = (a: Partial<Address> = {}): Address => ({
  streetAddress: a.streetAddress ?? SITE_ADDRESS.streetAddress,
  locality: a.locality ?? SITE_ADDRESS.locality,
  region: a.region ?? SITE_ADDRESS.region,
  postalCode: a.postalCode ?? SITE_ADDRESS.postalCode,
  country: a.country ?? SITE_ADDRESS.country,
});

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

/** A /data page's Dataset node: germomics compiled the page from its sources, so it is the creator and they are the citations. */
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

/** True when a post was updated on a later calendar day than it was published. */
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

// A page in a section passes its trail from lib/trails.ts, the one SectionTrail shows, so no BreadcrumbList names a crumb the page lacks.
const head = defineHead({
  origin: SITE_ORIGIN,
  siteName: "Germomics",
  suffix: " · Germomics",
  image: DEFAULT_CARD,
});

/**
 * The head of a public page from Prelum's defineHead, always on SITE_ORIGIN so a workers.dev copy never claims the
 * page. A description too long for a search result is cut at a word (the share card keeps it whole).
 * /feed/podcast/ keeps its slash: that URL never changes (CLAUDE.md, Podcast feed).
 */
export function pageHead({ path, ...page }: PageHead) {
  return head({ ...page, path, fullTitle: true, keepTrailingSlash: path === "/feed/podcast/" });
}
