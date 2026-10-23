// Feed builders. Byte-level control over every tag — no static-generation heuristics. The
// podcast feed carries episodes only (every item has an enclosure); the site feed carries the
// writing. Enclosure URLs always point at media.germomics.com (the stored audioUrl), never the
// worker origin. guid is permanent + isPermaLink=false. Served from resource routes.
import type { Post, ShowConfig, Soundbite } from "~/db/schema";
import type { GuestView } from "~/lib/types";
import { cdata, escapeXml, rfc822 } from "@drdustinedwards/site-helpers/xml";
import { formatHMS } from "~/lib/format";
import { OP3_ORIGIN } from "~/lib/site";

const PODCAST_NS =
  'xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" ' +
  'xmlns:podcast="https://podcastindex.org/namespace/1.0" ' +
  'xmlns:content="http://purl.org/rss/1.0/modules/content/" ' +
  'xmlns:atom="http://www.w3.org/2005/Atom"';

// OP3 (op3.dev) open, privacy-respecting download analytics. Podcast apps fetch the enclosure
// through this prefix, which counts the download then redirects to the real file. ONLY the
// enclosure URL is wrapped — guid, length, duration, and type are rendered verbatim and never
// change (guid is the immutable dedup key directories rely on). Idempotent: never double-wraps.
const OP3_PREFIX = `${OP3_ORIGIN}/e/`;
export function op3Enclosure(url: string): string {
  if (!url || url.includes("op3.dev/e/")) return url;
  return OP3_PREFIX + url.replace(/^https?:\/\//i, "");
}

/** Nested <itunes:category> elements (up to 3), falling back to the single legacy column. */
function categoriesXml(show: ShowConfig): string {
  const cats = show.categories?.length
    ? show.categories
    : [{ category: show.appleCategory }];
  return cats
    .map((c) =>
      c.subcategory
        ? `<itunes:category text="${escapeXml(c.category)}"><itunes:category text="${escapeXml(c.subcategory)}"/></itunes:category>`
        : `<itunes:category text="${escapeXml(c.category)}"/>`,
    )
    .join("\n  ");
}

/**
 * The podcast feed — episodes only. Served at the immutable path /feed/podcast/.
 * `guestsByEpisode` carries resolved people per episode for item-level <podcast:person>.
 */
export function buildPodcastFeed(
  show: ShowConfig,
  episodes: Post[],
  origin: string,
  guestsByEpisode: Map<number, GuestView[]> = new Map(),
  soundbitesByEpisode: Map<number, Soundbite[]> = new Map(),
): string {
  const items = episodes
    .filter((e) => e.audioUrl && e.guid)
    .map((e) => itemXml(e, origin, guestsByEpisode.get(e.id) ?? [], soundbitesByEpisode.get(e.id) ?? []))
    .join("\n");

  const funding = show.fundingUrl
    ? `<podcast:funding url="${escapeXml(show.fundingUrl)}">${escapeXml(show.fundingLabel || "Support the show")}</podcast:funding>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" ${PODCAST_NS}>
<channel>
  <title>${escapeXml(show.title)}</title>
  <link>${origin}/</link>
  <atom:link href="${origin}/feed/podcast/" rel="self" type="application/rss+xml"/>
  <language>${escapeXml(show.language)}</language>
  <description>${cdata(show.description)}</description>
  <itunes:author>${escapeXml(show.author)}</itunes:author>
  <itunes:summary>${cdata(show.description)}</itunes:summary>
  <itunes:type>${show.itunesType}</itunes:type>
  <itunes:explicit>${show.explicit ? "true" : "false"}</itunes:explicit>
  <itunes:image href="${escapeXml(show.artwork)}"/>
  ${categoriesXml(show)}
  <itunes:owner>
    <itunes:name>${escapeXml(show.author)}</itunes:name>
    <itunes:email>${escapeXml(show.ownerEmail)}</itunes:email>
  </itunes:owner>
  <podcast:person role="host" href="${origin}/">${escapeXml(show.author)}</podcast:person>
  <podcast:locked owner="${escapeXml(show.ownerEmail)}">yes</podcast:locked>
  ${funding}
${items}
</channel>
</rss>`;
}

/** A <podcast:person> per guest. role defaults to "guest"; img only when a photo URL exists. */
function personXml(g: GuestView, origin: string): string {
  const href = g.links?.[0]?.url ?? g.link ?? `${origin}/guests/${g.slug}`;
  const img = g.photo ? ` img="${escapeXml(g.photo)}"` : "";
  return `<podcast:person role="${escapeXml(g.role || "guest")}" href="${escapeXml(href)}"${img}>${escapeXml(g.name)}</podcast:person>`;
}

function itemXml(e: Post, origin: string, guests: GuestView[], soundbites: Soundbite[] = []): string {
  const url = `${origin}/${e.slug}`;
  const people = guests.map((g) => personXml(g, origin)).join("");
  const transcript = e.transcript
    ? `<podcast:transcript url="${url}/transcript.vtt" type="text/vtt"/>`
    : "";
  const chapters =
    e.chapters && e.chapters.length
      ? `<podcast:chapters url="${url}/chapters.json" type="application/json+chapters"/>`
      : "";
  // Podcasting 2.0 <podcast:soundbite> (additive). No rows yet, so this stays empty and the feed
  // bytes are unchanged; guid/enclosure/length/duration are never touched here.
  const clips = soundbites
    .map(
      (s) =>
        `\n    <podcast:soundbite startTime="${s.startSeconds}" duration="${s.durationSeconds}">${escapeXml(s.title || e.title)}</podcast:soundbite>`,
    )
    .join("");

  return `  <item>
    <title>${escapeXml(e.title)}</title>
    <link>${url}</link>
    <guid isPermaLink="false">${escapeXml(e.guid ?? url)}</guid>
    <pubDate>${rfc822(e.publishedAt)}</pubDate>
    <description>${cdata(e.excerpt ?? e.body)}</description>
    <content:encoded>${cdata(e.body)}</content:encoded>
    <enclosure url="${escapeXml(op3Enclosure(e.audioUrl!))}" length="${e.audioByteSize ?? 0}" type="${e.audioMimeType ?? "audio/mpeg"}"/>
    <itunes:duration>${formatHMS(e.audioDuration)}</itunes:duration>
    <itunes:explicit>${e.explicit ? "true" : "false"}</itunes:explicit>
    <itunes:episodeType>${e.episodeType ?? "full"}</itunes:episodeType>${
      e.episodeNumber ? `\n    <itunes:episode>${e.episodeNumber}</itunes:episode>` : ""
    }${e.seasonNumber ? `\n    <itunes:season>${e.seasonNumber}</itunes:season>` : ""}${
      e.episodeArtwork ? `\n    <itunes:image href="${escapeXml(e.episodeArtwork)}"/>` : ""
    }
    ${people}${transcript}${chapters}${clips}
  </item>`;
}

/** The writing feed — articles for regular feed readers. The guid is the one stored at first
 *  publish, so a later slug change does not re-announce the article (Grok audit 2026-10-21, GE-13). */
export function buildSiteFeed(show: ShowConfig, articles: Post[], origin: string): string {
  const items = articles
    .map(
      (a) => `  <item>
    <title>${escapeXml(a.title)}</title>
    <link>${origin}/${a.slug}</link>
    ${a.guid ? `<guid isPermaLink="false">${escapeXml(a.guid)}</guid>` : `<guid>${origin}/${a.slug}</guid>`}
    <pubDate>${rfc822(a.publishedAt)}</pubDate>
    <description>${cdata(a.excerpt ?? a.body)}</description>
    <content:encoded>${cdata(a.body)}</content:encoded>
  </item>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${escapeXml(show.title)}: Writing</title>
  <link>${origin}/writing</link>
  <atom:link href="${origin}/feed/site.xml" rel="self" type="application/rss+xml"/>
  <language>${escapeXml(show.language)}</language>
  <description>${cdata("Essays and notes from Germomics.")}</description>
${items}
</channel>
</rss>`;
}

/** Podcasting 2.0 chapters JSON body. */
export function buildChaptersJson(e: Post): string {
  return JSON.stringify({
    version: "1.2.0",
    chapters: (e.chapters ?? []).map((c) => ({
      startTime: c.start,
      title: c.title,
      ...(c.img ? { img: c.img } : {}),
      ...(c.url ? { url: c.url } : {}),
    })),
  });
}
