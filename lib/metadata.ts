// lib/metadata.ts Next Metadata builders. No hardcoded metadata strings in pages.

import type { Metadata } from 'next';
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/constants';

export const baseMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_TAGLINE,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    url: SITE_URL,
    title: SITE_NAME,
    description: SITE_TAGLINE,
  },
  twitter: { card: 'summary_large_image' },
};

export function pageMetadata(opts: {
  title: string;
  description?: string;
  path?: string;
  image?: string;
}): Metadata {
  const { title, description = SITE_TAGLINE, path = '/', image } = opts;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${path}`,
      images: image ? [{ url: image }] : undefined,
    },
  };
}
