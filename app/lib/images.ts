// Responsive images (client-safe): every way the site shows an image, as one site-runtime
// `defineImages` call, so a page never asks /media for a size or crop the route would refuse.
// Every picture is served from this origin, as dustinedwards.info serves its own: the original at /media/<key> and
// each size at /media/<key>?w= (app/routes/media.$.ts), from BLOG_IMAGES. A stored address is /media/<key>.
import { defineImages, type ImageAttributes } from "@dustinedwards/site-runtime/image";
import { SITE_ORIGIN } from "~/lib/site";

export const images = defineImages({
  uses: {
    // Body figures: the 400px photos and the 520px lead illustration (BodyRenderer caps each at its width attribute).
    figure: { layout: "constrained", width: 400 },
    leadFigure: { layout: "constrained", width: 520 },
    // The article cover, 2:1 across the max-w-3xl column, and the same cover on a /writing card.
    cover: { layout: "constrained", width: 768, ratio: "2x1" },
    card: { layout: "constrained", width: 480, ratio: "2x1", sizes: "(min-width: 640px) 480px, 100vw" },
    // The episode hero square (w-40, 12rem from sm, 14rem from lg).
    artwork: { layout: "constrained", width: 224, ratio: "1x1", sizes: "(min-width: 1024px) 224px, (min-width: 640px) 192px, 160px" },
    // Round guest and host photos: 48px in a post, 64px on a guest page.
    avatar: { layout: "fixed", width: 48, ratio: "1x1" },
    portrait: { layout: "fixed", width: 64, ratio: "1x1" },
    // A page's share card (og:image): its own image cut to 1200x630 around the focal point.
    share: { layout: "fixed", width: 1200, ratio: "40x21" },
  },
});

export type ImageUseName = Parameters<typeof images.attributes>[1];
export type { ImageAttributes };

/** What a loader hands a page: attributes per `use|src`, for the images it could size. */
export type ImageSet = Record<string, ImageAttributes>;

export const imageKey = (use: ImageUseName, src: string) => `${use}|${src}`;

/** The attributes for one image shown one way, or undefined when the loader could not size it. */
export function imageFor(set: ImageSet | undefined, use: ImageUseName, src: string | null | undefined): ImageAttributes | undefined {
  return src ? set?.[imageKey(use, src)] : undefined;
}

/** The prefixes a stored image address starts with: /media, relative or on this origin. */
const IMAGE_PREFIXES = ["/media/", `${SITE_ORIGIN}/media/`];

/** The BLOG_IMAGES key behind a stored image address (/media/<key>), or null for any other URL. */
export function imageKeyOf(src: string): string | null {
  const prefix = IMAGE_PREFIXES.find((p) => src.startsWith(p));
  if (!prefix) return null;
  const path = src.slice(prefix.length).split(/[?#]/)[0];
  if (!path) return null;
  try {
    return decodeURIComponent(path);
  } catch {
    return null;
  }
}

/** The /media path that serves a stored key (each segment encoded, the slashes kept). */
export function mediaPath(key: string): string {
  return `/media/${key.split("/").map(encodeURIComponent).join("/")}`;
}
