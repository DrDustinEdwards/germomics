import { useEffect, useRef, useState } from "react";
import { imageOrPlain, type ImageAttributes } from "~/lib/images";
import { Picture } from "capsomer/react/picture";
import wordmarkRaw from "~/components/brand/germomics-wordmark.svg?raw";
import { markup } from "capsomer/behavior/trusted-html";

// The item's own artwork, else the brand default as SVG: the footer's wordmark asset (so it cannot drift) in white on
// violet. xMidYMid meet is the SVG default, set explicitly so the lockup is never stretched.
const WORDMARK = wordmarkRaw.replace("<svg ", '<svg preserveAspectRatio="xMidYMid meet" ');

// Fixed violet in both themes, not --brand: that flips to a light lavender in dark mode and would wash out the white wordmark.
const VIOLET = "#4F2D7F";

// Placement measured from the raster germomics-artwork-1400.jpg: logo bbox left 5.71%, top 36.79%, 87.64% wide,
// 51.64% tall. The SVG has ~1% internal padding in its 904x540 viewBox, so the box is inflated to match; aspect
// 89.22/53.3 is the viewBox's, so meet leaves no letterbox.
const LOGO = { left: "4.93%", top: "36.0%", width: "89.22%", height: "53.3%" };

export function CoverArt({
  src,
  alt,
  className = "",
  eager = false,
  image,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  eager?: boolean;
  image?: ImageAttributes;
}) {
  const [failed, setFailed] = useState(false);
  const holder = useRef<HTMLSpanElement | null>(null);

  // An image's error event does not bubble, so listen in the capture phase; one that failed before hydration is seen by its size.
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const fail = () => setFailed(true);
    el.addEventListener("error", fail, true);
    const img = el.querySelector("img");
    if (img?.complete && img.naturalWidth === 0) fail();
    return () => el.removeEventListener("error", fail, true);
  }, [src, failed]);

  if (src && !failed) {
    return (
      <span ref={holder} className="gm-cover-holder">
        <Picture
          attrs={imageOrPlain(image, src, 1400, 1400)}
          alt={alt}
          priority={eager}
          className={`gm-cover gm-cover-photo ${className}`}
        />
      </span>
    );
  }

  return (
    <div
      role="img"
      aria-label={alt}
      className={`gm-cover gm-cover-default ${className}`}
      style={{ backgroundColor: VIOLET }}
    >
      <span
        aria-hidden="true"
        className="gm-cover-logo"
        style={{ left: LOGO.left, top: LOGO.top, width: LOGO.width, height: LOGO.height }}
        dangerouslySetInnerHTML={markup(WORDMARK)}
      />
    </div>
  );
}
