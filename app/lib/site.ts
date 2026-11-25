import { shareCard } from "@drdustinedwards/site-helpers/head";
// Canonical site-identity values (client-safe): the privacy page, schema.org and the email footer read the same address.

/** Feed enclosures always point at MEDIA_ORIGIN; every picture is /media/<key> on SITE_ORIGIN (app/lib/images.ts). */
export const SITE_HOST = "germomics.com";
export const SITE_ORIGIN = `https://${SITE_HOST}`;
/** For site-runtime's keyOfAddress and keysAtAddresses. */
export const MEDIA_ADDRESS = { origins: [SITE_ORIGIN] };
export const MEDIA_ORIGIN = "https://media.germomics.com";
export const DEFAULT_ARTWORK = `${SITE_ORIGIN}/media/brand/germomics-artwork-1400.jpg`;
export const DEFAULT_CARD = shareCard(
  `${SITE_ORIGIN}/brand/germomics-card.jpg`,
  "Germomics: a broadcasting microphone forming the M in the GERMOMICS wordmark",
);
/** Public by the IndexNow protocol's design: served as /<key>.txt. */
export const INDEXNOW_KEY = "e181c18855ea5175390b4e1124cc23fd";

/** Never prefetched, beyond the family's NEVER_PREFETCH: token pages whose actions unsubscribe and subscribe, draft previews and the feeds. Read by root.tsx and the speculation rules in workers/app.ts. */
export const NO_PREFETCH = ["/unsubscribe", "/subscribe/confirm", "/preview", "/feed"];

export const OP3_ORIGIN = "https://op3.dev";

export const SITE_ADDRESS = {
  streetAddress: "Box T-0100",
  locality: "Stephenville",
  region: "TX",
  postalCode: "76402",
  country: "US",
} as const;

export const SITE_ADDRESS_LINE = `${SITE_ADDRESS.streetAddress}, ${SITE_ADDRESS.locality}, ${SITE_ADDRESS.region} ${SITE_ADDRESS.postalCode}`;

export type Address = {
  streetAddress: string;
  locality: string;
  region: string;
  postalCode: string;
  country: string;
};

export const ROBOTS_DISALLOW = ["/admin", "/preview/"];

const CARREL_ORIGIN = "https://desk.dustinedwards.info";
export const carrelEditUrl = (id: string) =>
  `${CARREL_ORIGIN}/p/germomics/e/${encodeURIComponent(id)}`;

export const PAGE_HREF: Record<string, string> = {
  "page:about": "/about",
  "page:dustin-edwards": "/about/dustin-edwards",
  "page:privacy": "/privacy",
  "page:terms": "/terms",
  "page:contact": "/contact",
  "page:txasm": "/txasm",
  "page:llms": "/llms.txt",
  "page:ai-txt": "/ai.txt",
};
