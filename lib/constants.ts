// lib/constants.ts single source for hosts, the public origin, and site chrome.

export const SITE_URL = 'https://germomics.com';
export const SITE_NAME = 'germomics';
export const SITE_TAGLINE =
  'A podcast about microbiology and history, with the transcripts and writing to match.';

// Public media/image custom domains (R2). Enclosure URLs always use MEDIA_HOST.
export const MEDIA_HOST = 'media.germomics.com';
export const IMAGES_HOST = 'images.germomics.com';

// Canonical podcast feed path (unchanged from the old WordPress feed, so directories keep
// pulling from the same URL).
export const PODCAST_FEED_PATH = '/feed/podcast';
export const SITE_FEED_PATH = '/feed/articles';

export const NAV = [
  { href: '/episodes', label: 'Episodes' },
  { href: '/writing', label: 'Writing' },
  { href: '/archive', label: 'Archive' },
  { href: '/subscribe', label: 'Subscribe' },
] as const;
