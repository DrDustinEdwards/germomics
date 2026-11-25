// The podcast feed, byte for byte: the iTunes and Podcasting 2.0 tags Prelum's feeds lack (the writing feed is Prelum's
// rssDocument). Enclosures point at media.germomics.com (the stored audioUrl), never the Worker origin. guid is permanent.
import type { Post, ShowConfig, Soundbite } from "~/db/schema";
import type { GuestView } from "~/lib/types";
import { absolutizeUrls, cdata, escapeXml, rfc822 } from "@drdustinedwards/site-helpers/xml";
import { timecode } from "capsomer/behavior/time";
import { OP3_ORIGIN } from "~/lib/site";

const PODCAST_NS =
  'xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" ' +
  'xmlns:podcast="https://podcastindex.org/namespace/1.0" ' +
  'xmlns:content="http://purl.org/rss/1.0/modules/content/" ' +
  'xmlns:atom="http://www.w3.org/2005/Atom"';

// OP3 counts a download then redirects to the file. Only the enclosure URL is wrapped; guid, length, duration and type stay verbatim. Idempotent.
const OP3_PREFIX = `${OP3_ORIGIN}/e/`;
export function op3Enclosure(url: string): string {
  if (!url || url.includes("op3.dev/e/")) return url;
  return OP3_PREFIX + url.replace(/^https?:\/\//i, "");
}

function categoriesXml(show: ShowConfig): string {
  const cats = show.categories?.length ? show.categories : [{ category: show.appleCategory }];
  return cats
    .map((c) =>
      c.subcategory
        ? `<itunes:category text="${escapeXml(c.category)}"><itunes:category text="${escapeXml(c.subcategory)}"/></itunes:category>`
        : `<itunes:category text="${escapeXml(c.category)}"/>`,
    )
    .join("\n  ");
}

/** `guestsByEpisode` carries resolved people per episode for item-level <podcast:person>. */
export function buildPodcastFeed(
  show: ShowConfig,
  episodes: Post[],
  origin: string,
  guestsByEpisode: Map<number, GuestView[]> = new Map(),
  soundbitesByEpisode: Map<number, Soundbite[]> = new Map(),
): string {
  const items = episodes
    .filter((e) => e.audioUrl && e.guid)
    .map((e) =>
      itemXml(e, origin, guestsByEpisode.get(e.id) ?? [], soundbitesByEpisode.get(e.id) ?? []),
    )
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
  <itunes:type>${escapeXml(show.itunesType)}</itunes:type>
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

function personXml(g: GuestView, origin: string): string {
  const href = g.links?.[0]?.url ?? g.link ?? `${origin}/guests/${g.slug}`;
  const img = g.photo ? ` img="${escapeXml(g.photo)}"` : "";
  return `<podcast:person role="${escapeXml(g.role || "guest")}" href="${escapeXml(href)}"${img}>${escapeXml(g.name)}</podcast:person>`;
}

function itemXml(
  e: Post,
  origin: string,
  guests: GuestView[],
  soundbites: Soundbite[] = [],
): string {
  const url = `${origin}/${e.slug}`;
  // The rendered body (listFullPosts), its /media sizes made absolute: a feed item is read on another origin.
  const body = absolutizeUrls(e.bodyHtml ?? "", origin);
  const people = guests.map((g) => personXml(g, origin)).join("");
  const transcript = e.transcript
    ? `<podcast:transcript url="${url}/transcript.vtt" type="text/vtt"/>`
    : "";
  const chapters =
    e.chapters && e.chapters.length
      ? `<podcast:chapters url="${url}/chapters.json" type="application/json+chapters"/>`
      : "";
  // <podcast:soundbite> is additive: with no rows the feed bytes are unchanged.
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
    <description>${cdata(e.excerpt ?? body)}</description>
    <content:encoded>${cdata(body)}</content:encoded>
    <enclosure url="${escapeXml(op3Enclosure(e.audioUrl!))}" length="${e.audioByteSize ?? 0}" type="${escapeXml(e.audioMimeType ?? "audio/mpeg")}"/>
    <itunes:duration>${timecode((e.audioDuration ?? 0) * 1000, { hours: "always" })}</itunes:duration>
    <itunes:explicit>${e.explicit ? "true" : "false"}</itunes:explicit>
    <itunes:episodeType>${escapeXml(e.episodeType ?? "full")}</itunes:episodeType>${
      e.episodeNumber ? `\n    <itunes:episode>${e.episodeNumber}</itunes:episode>` : ""
    }${e.seasonNumber ? `\n    <itunes:season>${e.seasonNumber}</itunes:season>` : ""}${
      e.episodeArtwork ? `\n    <itunes:image href="${escapeXml(e.episodeArtwork)}"/>` : ""
    }
    ${people}${transcript}${chapters}${clips}
  </item>`;
}

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
