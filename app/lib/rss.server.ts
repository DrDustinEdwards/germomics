// Feed builders. Byte-level control over every tag — no static-generation heuristics. The
// podcast feed carries episodes only (every item has an enclosure); the site feed carries the
// writing. Enclosure URLs always point at media.germomics.com (the stored audioUrl), never the
// worker origin. guid is permanent + isPermaLink=false. Served from resource routes.
import type { Post, ShowConfig } from "~/db/schema";
import { formatHMS, rfc822, xmlEscape } from "~/lib/format";
import { slugifyGuest } from "~/lib/posts.server";

const PODCAST_NS =
  'xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" ' +
  'xmlns:podcast="https://podcastindex.org/namespace/1.0" ' +
  'xmlns:content="http://purl.org/rss/1.0/modules/content/" ' +
  'xmlns:atom="http://www.w3.org/2005/Atom"';

function cdata(value: string | null | undefined): string {
  return `<![CDATA[${value ?? ""}]]>`;
}

/** The podcast feed — episodes only. Served at the immutable path /feed/podcast/. */
export function buildPodcastFeed(show: ShowConfig, episodes: Post[], origin: string): string {
  const items = episodes
    .filter((e) => e.audioUrl && e.guid)
    .map((e) => itemXml(e, show, origin))
    .join("\n");

  const categories = `<itunes:category text="${xmlEscape(show.appleCategory)}"/>`;
  const funding = show.fundingUrl
    ? `<podcast:funding url="${xmlEscape(show.fundingUrl)}">Support germomics</podcast:funding>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" ${PODCAST_NS}>
<channel>
  <title>${xmlEscape(show.title)}</title>
  <link>${origin}/</link>
  <atom:link href="${origin}/feed/podcast/" rel="self" type="application/rss+xml"/>
  <language>${xmlEscape(show.language)}</language>
  <description>${cdata(show.description)}</description>
  <itunes:author>${xmlEscape(show.author)}</itunes:author>
  <itunes:summary>${cdata(show.description)}</itunes:summary>
  <itunes:type>${show.itunesType}</itunes:type>
  <itunes:explicit>${show.explicit ? "true" : "false"}</itunes:explicit>
  <itunes:image href="${xmlEscape(show.artwork)}"/>
  ${categories}
  <itunes:owner>
    <itunes:name>${xmlEscape(show.author)}</itunes:name>
    <itunes:email>${xmlEscape(show.ownerEmail)}</itunes:email>
  </itunes:owner>
  <podcast:locked owner="${xmlEscape(show.ownerEmail)}">yes</podcast:locked>
  ${funding}
${items}
</channel>
</rss>`;
}

function itemXml(e: Post, show: ShowConfig, origin: string): string {
  const url = `${origin}/${e.slug}`;
  const people = (e.guests ?? [])
    .map(
      (g) =>
        `<podcast:person role="guest" href="${xmlEscape(g.link ?? `${origin}/guests/${slugifyGuest(g.name)}`)}">${xmlEscape(g.name)}</podcast:person>`,
    )
    .join("");
  const transcript = e.transcript
    ? `<podcast:transcript url="${url}/transcript.txt" type="text/plain"/>`
    : "";
  const chapters =
    e.chapters && e.chapters.length
      ? `<podcast:chapters url="${url}/chapters.json" type="application/json+chapters"/>`
      : "";

  return `  <item>
    <title>${xmlEscape(e.title)}</title>
    <link>${url}</link>
    <guid isPermaLink="false">${xmlEscape(e.guid ?? url)}</guid>
    <pubDate>${rfc822(e.publishedAt)}</pubDate>
    <description>${cdata(e.excerpt ?? e.body)}</description>
    <content:encoded>${cdata(e.body)}</content:encoded>
    <enclosure url="${xmlEscape(e.audioUrl!)}" length="${e.audioByteSize ?? 0}" type="${e.audioMimeType ?? "audio/mpeg"}"/>
    <itunes:duration>${formatHMS(e.audioDuration)}</itunes:duration>
    <itunes:explicit>${e.explicit ? "true" : "false"}</itunes:explicit>
    <itunes:episodeType>${e.episodeType ?? "full"}</itunes:episodeType>${
      e.episodeNumber ? `\n    <itunes:episode>${e.episodeNumber}</itunes:episode>` : ""
    }${e.seasonNumber ? `\n    <itunes:season>${e.seasonNumber}</itunes:season>` : ""}${
      e.episodeArtwork ? `\n    <itunes:image href="${xmlEscape(e.episodeArtwork)}"/>` : ""
    }
    ${people}${transcript}${chapters}
  </item>`;
}

/** The writing feed — articles for regular feed readers. */
export function buildSiteFeed(show: ShowConfig, articles: Post[], origin: string): string {
  const items = articles
    .map(
      (a) => `  <item>
    <title>${xmlEscape(a.title)}</title>
    <link>${origin}/${a.slug}</link>
    <guid>${origin}/${a.slug}</guid>
    <pubDate>${rfc822(a.publishedAt)}</pubDate>
    <description>${cdata(a.excerpt ?? a.body)}</description>
    <content:encoded>${cdata(a.body)}</content:encoded>
  </item>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>${xmlEscape(show.title)} — Writing</title>
  <link>${origin}/writing</link>
  <atom:link href="${origin}/feed/site.xml" rel="self" type="application/rss+xml"/>
  <language>${xmlEscape(show.language)}</language>
  <description>${cdata("Essays and notes from germomics.")}</description>
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
