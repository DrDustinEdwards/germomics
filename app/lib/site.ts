// Canonical site-identity values (client-safe). One source of truth so the privacy page, the
// schema.org PostalAddress, and any future newsletter email footer all read the same address.
// Mirrors the Vault's site-config.md. Postal address is provisional (per Dustin, 2026-06-21).

export const SITE_ADDRESS = {
  streetAddress: "Box T-0100",
  locality: "Stephenville",
  region: "TX",
  postalCode: "76402",
  country: "US",
} as const;

/** One-line human form — e.g. the CAN-SPAM physical address in the newsletter email footer. */
export const SITE_ADDRESS_LINE = "Box T-0100, Stephenville, TX 76402";

/** schema.org PostalAddress node, for embedding in Organization / PodcastSeries. */
export function postalAddressLd() {
  return {
    "@type": "PostalAddress",
    streetAddress: SITE_ADDRESS.streetAddress,
    addressLocality: SITE_ADDRESS.locality,
    addressRegion: SITE_ADDRESS.region,
    postalCode: SITE_ADDRESS.postalCode,
    addressCountry: SITE_ADDRESS.country,
  };
}
