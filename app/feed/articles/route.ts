// app/feed/articles/route.ts the site feed (writing only). Episodes use /feed/podcast.

import { db } from '@/lib/db';
import { posts } from '@/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { escapeXml, rfc822 } from '@/lib/rss';
import { SITE_URL, SITE_NAME, SITE_TAGLINE } from '@/lib/constants';

export const revalidate = 600;

export async function GET() {
  const articles = await db
    .select()
    .from(posts)
    .where(and(eq(posts.kind, 'article'), eq(posts.status, 'published')))
    .orderBy(desc(posts.publishedAt));

  const items = articles
    .map(
      (a) => `
    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${SITE_URL}/writing/${escapeXml(a.slug)}</link>
      <guid isPermaLink="true">${SITE_URL}/writing/${escapeXml(a.slug)}</guid>
      <pubDate>${rfc822(a.publishedAt)}</pubDate>
      <description><![CDATA[${a.excerpt ?? ''}]]></description>
      <content:encoded><![CDATA[${a.body ?? ''}]]></content:encoded>
    </item>`,
    )
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(SITE_NAME)} · writing</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_TAGLINE)}</description>
    <language>en-us</language>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=UTF-8' },
  });
}
