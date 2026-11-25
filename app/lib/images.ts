// Responsive images (client-safe): every way the site shows an image, as one defineImages call, so a page never asks
// /media for a size or crop the route would refuse. The original is /media/<key>, each size /media/<key>?w= (app/routes/media.$.ts).
import { defineImages, type ImageAttributes } from "@dustinedwards/site-runtime/image";

export const images = defineImages({
  uses: {
    // Body figures; BodyRenderer caps each at its width attribute.
    figure: { layout: "constrained", width: 400 },
    leadFigure: { layout: "constrained", width: 520 },
    cover: { layout: "constrained", width: 768, ratio: "2x1" },
    card: {
      layout: "constrained",
      width: 480,
      ratio: "2x1",
      sizes: "(min-width: 640px) 480px, 100vw",
    },
    artwork: {
      layout: "constrained",
      width: 224,
      ratio: "1x1",
      sizes: "(min-width: 1024px) 224px, (min-width: 640px) 192px, 160px",
    },
    avatar: { layout: "fixed", width: 48, ratio: "1x1" },
    portrait: { layout: "fixed", width: 64, ratio: "1x1" },
    share: { layout: "fixed", width: 1200, ratio: "40x21" },
  },
});

export type ImageUseName = Parameters<typeof images.attributes>[1];
export type { ImageAttributes };

export type ImageSet = Record<string, ImageAttributes>;

export const imageKey = (use: ImageUseName, src: string) => `${use}|${src}`;

export function imageFor(
  set: ImageSet | undefined,
  use: ImageUseName,
  src: string | null | undefined,
): ImageAttributes | undefined {
  return src ? set?.[imageKey(use, src)] : undefined;
}

/** The loader's attributes, or for an image it could not size a plain <img> with no sources. */
export function imageOrPlain(
  image: ImageAttributes | undefined,
  src: string,
  width?: number,
  height?: number,
): ImageAttributes {
  return (
    image ?? {
      src,
      srcset: undefined,
      sizes: undefined,
      sources: [],
      width,
      height,
      background: undefined,
    }
  );
}

export function mediaPath(key: string): string {
  return `/media/${key.split("/").map(encodeURIComponent).join("/")}`;
}
