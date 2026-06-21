// lib/rss.ts shared RSS helpers. The podcast feed (app/feed/podcast/route.ts) is the
// Blubrry replacement and is intentionally self-contained; this module backs the site feed
// for articles and any future feed surface.

/** Escape a string for use in XML text or attribute values. */
export function escapeXml(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** RFC-822 date for RSS pubDate. */
export function rfc822(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toUTCString();
}
