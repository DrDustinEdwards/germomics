// Canonical site-identity values (client-safe). One source of truth so the privacy page, the
// schema.org PostalAddress, and any future newsletter email footer all read the same address.
// Mirrors the Vault's site-config.md. Postal address is provisional (per Dustin, 2026-06-21).

/**
 * The site and the two R2 subdomains it serves media from. Feed enclosures always point at MEDIA_ORIGIN. Stored image
 * URLs are originals at IMAGE_ORIGIN; the resized copies pages show come from SITE_ORIGIN/media (app/lib/images.ts).
 */
export const SITE_HOST = "germomics.com";
export const SITE_ORIGIN = `https://${SITE_HOST}`;
export const MEDIA_ORIGIN = "https://media.germomics.com";
export const IMAGE_ORIGIN = "https://images.germomics.com";
/** The show's square cover art: its artwork in the feed until show_config sets one. */
export const DEFAULT_ARTWORK = `${IMAGE_ORIGIN}/brand/germomics-artwork-1400.jpg`;
/** The share card of any page without its own image: the wordmark at 1200x630 (scripts/gen-icons.mjs). */
export const DEFAULT_CARD = {
  url: `${SITE_ORIGIN}/brand/germomics-card.jpg`,
  width: 1200,
  height: 630,
  alt: "Germomics: a broadcasting microphone forming the M in the GERMOMICS wordmark",
};
/** The site's IndexNow key, public by the protocol's design: served as /<key>.txt and sent with each changed page. */
export const INDEXNOW_KEY = "e181c18855ea5175390b4e1124cc23fd";

/** The vulnerability contact /.well-known/security.txt lists, and the date it is next confirmed by (the family check warns first). */
export const SECURITY_CONTACT = "security@dustinedwards.info";
export const SECURITY_TXT_EXPIRES = "2027-09-28T00:00:00Z";

/** OP3 (op3.dev), the download analytics prefix the podcast feed wraps enclosures in. */
export const OP3_ORIGIN = "https://op3.dev";

const SITE_ADDRESS = {
  streetAddress: "Box T-0100",
  locality: "Stephenville",
  region: "TX",
  postalCode: "76402",
  country: "US",
} as const;

/** One-line human form — e.g. the CAN-SPAM physical address in the newsletter email footer. */
export const SITE_ADDRESS_LINE = `${SITE_ADDRESS.streetAddress}, ${SITE_ADDRESS.locality}, ${SITE_ADDRESS.region} ${SITE_ADDRESS.postalCode}`;

export type Address = {
  streetAddress: string;
  locality: string;
  region: string;
  postalCode: string;
  country: string;
};

/**
 * schema.org PostalAddress node, for embedding in Organization / PodcastSeries. Accepts a partial
 * address (from the contact.address setting); any missing field falls back to SITE_ADDRESS.
 */
export function postalAddressLd(a: Partial<Address> = {}) {
  return {
    "@type": "PostalAddress",
    streetAddress: a.streetAddress ?? SITE_ADDRESS.streetAddress,
    addressLocality: a.locality ?? SITE_ADDRESS.locality,
    addressRegion: a.region ?? SITE_ADDRESS.region,
    postalCode: a.postalCode ?? SITE_ADDRESS.postalCode,
    addressCountry: a.country ?? SITE_ADDRESS.country,
  };
}

/** Paths no crawler needs, in /robots.txt and /ai.txt alike. */
export const ROBOTS_DISALLOW = ["/admin", "/preview/"];

/** Carrel's Desk, the family's writing editor, where this site's posts and pages are written (app/lib/carrel/adapter.server.ts). */
const CARREL_ORIGIN = "https://desk.dustinedwards.info";
/** The Carrel editor for one of this site's items, by its Carrel id (a post's slug, `page.<name>` for a page). */
export const carrelEditUrl = (id: string) => `${CARREL_ORIGIN}/p/germomics/e/${encodeURIComponent(id)}`;
