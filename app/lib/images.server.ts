// Server half of the responsive images (app/lib/images.ts): reads each stored original's size for the cover,
// artwork and people photos a page shows. A body's figures are sized when it is rendered, from the media library
// (app/lib/render.server.ts).
//
// THE SIZE OF AN ORIGINAL. An upload records its width and height as R2 custom metadata (measured
// by site-api's prepareUpload). The season 1 figures were uploaded before that, as pre-made
// `<slug>-<width>.webp` files, so for those the width is read from the name and the shape from the
// figure's own width and height. An image with neither is left as it is: the original,
// unsized, is better than a guess (site-runtime's rule).
import { FOCUS_METADATA, type StoredImage } from "@dustinedwards/site-runtime/image";
import type { HeadImage } from "@drdustinedwards/site-helpers/head";
import { DEFAULT_CARD, SITE_ORIGIN } from "~/lib/site";
import { imageKey, imageKeyOf, images, mediaPath, type ImageSet, type ImageUseName } from "~/lib/images";

const NAMED_WIDTH = /-(\d{2,4})\.(?:webp|jpe?g|png|avif|gif)$/i;

const positive = (v: string | null | undefined): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * One original as /media serves it, with its size, or null when it is not in BLOG_IMAGES. `aspect`
 * (height over width) stands in for a height the file does not record.
 */
async function storedImage(env: Env, src: string, aspect?: number): Promise<StoredImage | null> {
  const key = imageKeyOf(src);
  if (!key) return null;
  const head = await env.BLOG_IMAGES.head(key).catch(() => null);
  if (!head) return null;
  const meta = head.customMetadata ?? {};
  const width = positive(meta.width) ?? positive(NAMED_WIDTH.exec(key)?.[1]);
  const height = positive(meta.height) ?? (width && aspect ? Math.round(width * aspect) : null);
  return { src: mediaPath(key), width, height, focus: meta[FOCUS_METADATA] ?? null };
}

/**
 * The attributes for each image a page shows, keyed by `use|src` (read with `imageFor`). A crop
 * (every use but the figures has a ratio) fixes the shape, so only the width bounds its sizes.
 * Images the site cannot size are left out, and the page shows them as they are.
 */
export async function imageSet(env: Env, wanted: Array<[ImageUseName, string | null | undefined]>): Promise<ImageSet> {
  const srcs = [...new Set(wanted.map(([, src]) => src).filter((s): s is string => Boolean(s)))];
  const stored = new Map(await Promise.all(srcs.map(async (src) => [src, await storedImage(env, src, 1)] as const)));
  const set: ImageSet = {};
  for (const [use, src] of wanted) {
    const image = src ? stored.get(src) : null;
    if (!src || !image) continue;
    const attrs = images.attributes(image, use);
    if (attrs.sources.length) set[imageKey(use, src)] = attrs;
  }
  return set;
}

/**
 * A page's share card: its own image as /media serves it cut to 1200x630 around its focal point, with that size. An
 * image the site cannot size or crop (not in BLOG_IMAGES, or narrower than the card) is sent as it is; no image is the
 * site's wordmark card.
 */
export async function shareImage(env: Env, own: { src: string; alt: string | null } | null | undefined): Promise<HeadImage> {
  if (!own?.src) return DEFAULT_CARD;
  const alt = own.alt ?? undefined;
  const stored = await storedImage(env, own.src, 1);
  const card = stored ? images.attributes(stored, "share") : null;
  if (!card?.sources.length) return { url: own.src, alt };
  return { url: `${SITE_ORIGIN}${card.src}`, width: card.width, height: card.height, alt };
}

/** What the post page (and its preview) shows besides the body: the cover, artwork and people photos. */
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
