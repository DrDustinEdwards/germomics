// app/feed/podcast/route.ts the Blubrry replacement.
// Serves the podcast feed at /feed/podcast/ (same path as the old WordPress feed), so
// Apple, Spotify, Amazon, Pandora, and TuneIn never need a directory change.

import { db } from '@/lib/db';
import { posts, showConfig } from '@/db/schema';
import { and, desc, eq } from 'drizzle-orm';

export const revalidate = 600;

const SITE = 'https://germomics.com';

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function hms(sec?: number | null): string {
  if (!sec) return '';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

export async function GET() {
  const show = (await db.select().from(showConfig).limit(1))[0];
  const episodes = await db.select().from(posts)
    .where(and(eq(posts.kind, 'episode'), eq(posts.status, 'published')))
    .orderBy(desc(posts.publishedAt));

  const items = episodes.map((e) => {
    const pub = e.publishedAt ? new Date(e.publishedAt).toUTCString() : '';
    const transcriptUrl = e.transcript ? `${SITE}/transcript/${esc(e.slug)}.vtt` : '';
    const chaptersUrl = e.chapters?.length ? `${SITE}/chapters/${esc(e.guid ?? e.slug)}.json` : '';
    const people = (e.guests ?? []).map((g) =>
      `<podcast:person role="guest"${g.img ? ` img="${esc(g.img)}"` : ''}${g.link ? ` href="${esc(g.link)}"` : ''}>${esc(g.name)}</podcast:person>`
    ).join('');

    return `
    <item>
      <title>${esc(e.title)}</title>
      <link>${SITE}/episodes/${esc(e.slug)}</link>
      <guid isPermaLink="false">${esc(e.guid ?? e.slug)}</guid>
      <pubDate>${pub}</pubDate>
      <description><![CDATA[${e.excerpt ?? ''}]]></description>
      <content:encoded><![CDATA[${e.body ?? ''}]]></content:encoded>
      <enclosure url="${esc(e.audioUrl)}" length="${e.audioByteSize ?? 0}" type="${esc(e.audioMimeType ?? 'audio/mpeg')}" />
      <itunes:duration>${hms(e.audioDuration)}</itunes:duration>
      <itunes:explicit>${e.explicit ? 'true' : 'false'}</itunes:explicit>
      ${e.episodeNumber ? `<itunes:episode>${e.episodeNumber}</itunes:episode>` : ''}
      ${e.seasonNumber ? `<itunes:season>${e.seasonNumber}</itunes:season>` : ''}
      <itunes:episodeType>${esc(e.episodeType ?? 'full')}</itunes:episodeType>
      ${e.episodeArtwork ? `<itunes:image href="${esc(e.episodeArtwork)}" />` : ''}
      ${transcriptUrl ? `<podcast:transcript url="${transcriptUrl}" type="text/vtt" />` : ''}
      ${chaptersUrl ? `<podcast:chapters url="${chaptersUrl}" type="application/json+chapters" />` : ''}
      ${people}
    </item>`;
  }).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:podcast="https://podcastindex.org/namespace/1.0">
  <channel>
    <title>${esc(show?.title)}</title>
    <link>${SITE}</link>
    <language>${esc(show?.language ?? 'en-us')}</language>
    <description>${esc(show?.description)}</description>
    <itunes:author>${esc(show?.author)}</itunes:author>
    <itunes:owner><itunes:name>${esc(show?.author)}</itunes:name><itunes:email>${esc(show?.ownerEmail)}</itunes:email></itunes:owner>
    <itunes:image href="${esc(show?.artwork)}" />
    <itunes:category text="${esc(show?.appleCategory)}" />
    <itunes:explicit>${show?.explicit ? 'true' : 'false'}</itunes:explicit>
    <itunes:type>${esc(show?.itunesType ?? 'episodic')}</itunes:type>
    <podcast:locked>yes</podcast:locked>
    ${show?.fundingUrl ? `<podcast:funding url="${esc(show.fundingUrl)}">Support germomics</podcast:funding>` : ''}
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=UTF-8' },
  });
}
