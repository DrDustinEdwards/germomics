// Canonical site-identity values (client-safe). One source of truth so the privacy page, the
// schema.org PostalAddress, and any future newsletter email footer all read the same address.
// Mirrors the Vault's site-config.md. Postal address is provisional (per Dustin, 2026-06-21).

/** The site and the two R2 subdomains it serves media from. Feed enclosures always point at MEDIA_ORIGIN. */
export const SITE_HOST = "germomics.com";
export const SITE_ORIGIN = `https://${SITE_HOST}`;
export const MEDIA_ORIGIN = "https://media.germomics.com";
export const IMAGE_ORIGIN = "https://images.germomics.com";
/** OP3 (op3.dev), the download analytics prefix the podcast feed wraps enclosures in. */
export const OP3_ORIGIN = "https://op3.dev";

export const SITE_ADDRESS = {
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
