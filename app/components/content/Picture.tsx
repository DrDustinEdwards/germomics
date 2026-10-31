// An image with its AVIF and WebP sizes from /media when the loader could size it (app/lib/images.ts),
// or the plain <img> it always was when not: site-runtime's pictureProps, the same markup as the
// body's pictureHtml. The <picture> is display: contents, so the <img> keeps its own classes and
// layout exactly as before.
import type { ImgHTMLAttributes } from "react";
import { pictureProps } from "@dustinedwards/site-runtime/image";
import type { ImageAttributes } from "~/lib/images";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "sizes" | "width" | "height" | "loading" | "fetchPriority" | "decoding"> & {
  src: string;
  alt: string;
  image?: ImageAttributes;
  width?: number;
  height?: number;
  /** The page's one LCP image: eager, fetchpriority high. Every other one is lazy. */
  priority?: boolean;
};

export function Picture({ src, image, width, height, alt, className, priority, ...rest }: Props) {
  const attrs = image ?? { src, srcset: undefined, sizes: undefined, sources: [], width, height };
  const { sources, img } = pictureProps(attrs, { alt, priority, className });
  if (sources.length === 0) return <img {...img} {...rest} />;
  return (
    <picture className="contents">
      {sources.map((s) => (
        <source key={s.type + (s.media ?? "")} {...s} />
      ))}
      <img {...img} {...rest} />
    </picture>
  );
}
