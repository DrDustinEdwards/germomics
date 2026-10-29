// An image with its AVIF and WebP sizes from /media when the loader could size it (app/lib/images.ts),
// or the plain <img> it always was when not. The <picture> is display: contents, so the <img> keeps
// its own classes and layout exactly as before.
import type { ImgHTMLAttributes } from "react";
import type { ImageAttributes } from "~/lib/images";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "sizes"> & {
  src: string;
  alt: string;
  image?: ImageAttributes;
};

export function Picture({ src, image, width, height, ...img }: Props) {
  if (!image) return <img src={src} width={width} height={height} {...img} />;
  return (
    <picture className="contents">
      {image.sources.map((s) => (
        <source key={s.type} type={s.type} srcSet={s.srcset} sizes={image.sizes} />
      ))}
      <img src={image.src} srcSet={image.srcset} sizes={image.sizes} width={image.width} height={image.height} {...img} />
    </picture>
  );
}
