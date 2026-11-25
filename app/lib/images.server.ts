// Server half of the responsive images (app/lib/images.ts): the size of each stored original behind a page's cover,
// artwork and people photos. An upload records width and height as R2 custom metadata (site-api's prepareUpload).
// Season 1 figures predate that as `<slug>-<width>.webp`, so their width is read from the name. An image with neither
// is left unsized: better than a guess (site-runtime's rule).
import { FOCUS_METADATA, keyOfAddress, type StoredImage } from "@dustinedwards/site-runtime/image";
import type { HeadImage } from "@drdustinedwards/site-helpers/head";
import { inList } from "@dustinedwards/site-runtime/d1";
import { logEvent } from "@dustinedwards/site-runtime/log";
import { getDb } from "~/db/index.server";
import { media } from "~/db/schema";
import { DEFAULT_CARD, MEDIA_ADDRESS, SITE_ORIGIN } from "~/lib/site";
import { imageKey, images, mediaPath, type ImageSet, type ImageUseName } from "~/lib/images";

const NAMED_WIDTH = /-(\d{2,4})\.(?:webp|jpe?g|png|avif|gif)$/i;

const positive = (v: string | null | undefined): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** One original as /media serves it, or null when not in BLOG_IMAGES. `aspect` (height over width) stands in for an unrecorded height. */
async function storedImage(env: Env, src: string, aspect?: number): Promise<StoredImage | null> {
  const key = keyOfAddress(src, MEDIA_ADDRESS);
  if (!key) return null;
  const head = await env.BLOG_IMAGES.head(key).catch((error) => {
    logEvent("images.head_failed", { key, error }, { level: "error" });
    return null;
  });
  if (!head) return null;
  const meta = head.customMetadata ?? {};
  const width = positive(meta.width) ?? positive(NAMED_WIDTH.exec(key)?.[1]);
  const height = positive(meta.height) ?? (width && aspect ? Math.round(width * aspect) : null);
  // The etag is the `v=` of its size URLs, so a replaced file is a new URL, not the year-old cached copy.
  return {
    src: mediaPath(key),
    width,
    height,
    focus: meta[FOCUS_METADATA] ?? null,
    version: head.etag,
  };
}

async function placeholders(
  env: Env,
  keys: string[],
): Promise<Map<string, { placeholder: string | null; color: string | null }>> {
  if (keys.length === 0) return new Map();
  const rows = await getDb(env)
    .select({ key: media.key, placeholder: media.placeholder, color: media.color })
    .from(media)
    .where(inList(media.key, keys));
  return new Map(rows.map((r) => [r.key, { placeholder: r.placeholder, color: r.color }]));
}

/** The attributes for each image a page shows, keyed by `use|src` (read with `imageFor`). Images that cannot be sized are left out. */
export async function imageSet(
  env: Env,
  wanted: Array<[ImageUseName, string | null | undefined]>,
): Promise<ImageSet> {
  const srcs = [...new Set(wanted.map(([, src]) => src).filter((s): s is string => Boolean(s)))];
  const [stored, held] = await Promise.all([
    Promise.all(srcs.map(async (src) => [src, await storedImage(env, src, 1)] as const)).then(
      (pairs) => new Map(pairs),
    ),
    placeholders(
      env,
      srcs.map((s) => keyOfAddress(s, MEDIA_ADDRESS)).filter((k): k is string => k !== null),
    ),
  ]);
  const set: ImageSet = {};
  for (const [use, src] of wanted) {
    const image = src ? stored.get(src) : null;
    if (!src || !image) continue;
    const key = keyOfAddress(src, MEDIA_ADDRESS);
    const attrs = images.attributes({ ...image, ...(key ? held.get(key) : undefined) }, use);
    if (attrs.sources.length) set[imageKey(use, src)] = attrs;
  }
  return set;
}

// 3:2 is the narrowest picture that survives the card's 1.9:1 cut.
const WIDE = 1.5;

/** A page's share card: its image cut to 1200x630 at its focal point. A square or tall image would lose its subject, so it gets the wordmark card. */
export async function shareImage(
  env: Env,
  own: { src: string; alt: string | null } | null | undefined,
): Promise<HeadImage> {
  if (!own?.src) return DEFAULT_CARD;
  const alt = own.alt ?? undefined;
  const stored = await storedImage(env, own.src, 1);
  if (stored?.width && stored.height && stored.width / stored.height < WIDE) return DEFAULT_CARD;
  const card = stored ? images.attributes(stored, "share") : null;
  if (!card?.sources.length) return { url: new URL(own.src, SITE_ORIGIN).href, alt };
  return { url: `${SITE_ORIGIN}${card.src}`, width: card.width, height: card.height, alt };
}

export function postImages(
  env: Env,
  post: { coverImage: string | null },
  cover: string | null,
  people: { guests: Array<{ photo?: string | null }>; hosts: Array<{ img?: string | null }> },
): Promise<ImageSet> {
  return imageSet(env, [
    ["cover", post.coverImage],
    ["artwork", cover],
    ...people.guests.map((g) => ["avatar", g.photo] as [ImageUseName, string | null | undefined]),
    ...people.hosts.map((h) => ["avatar", h.img] as [ImageUseName, string | null | undefined]),
  ]);
}
