import { useEffect, useRef, useState } from "react";
import { imageOrPlain, type ImageAttributes } from "~/lib/images";
import { Picture } from "capsomer/react/picture";
import wordmarkRaw from "~/components/brand/germomics-wordmark.svg?raw";
import { markup } from "capsomer/behavior/trusted-html";

// Single shared cover. If the item has its own artwork, render that raster; otherwise render the
// brand default as crisp SVG: the white wordmark on the crystal-violet field, instead of the raster
// germomics-artwork-1400.jpg. Reuses the EXACT same wordmark asset the footer uses (currentColor
// path data) so it can never drift from a duplicated copy. The spec requires xMidYMid meet; that is
// also the SVG default, but we set it explicitly so the lockup is never stretched.
const WORDMARK = wordmarkRaw.replace("<svg ", '<svg preserveAspectRatio="xMidYMid meet" ');

// Fixed crystal violet in BOTH themes. NOT the --brand token: it flips to a light lavender in dark
// mode, which would wash out the white wordmark. The wordmark stays white in both themes.
const VIOLET = "#4F2D7F";

// Placement of the white wordmark, measured from the live raster germomics-artwork-1400.jpg (not
// guessed): the white-logo bbox is left 5.71%, top 36.79%, 87.64% wide, 51.64% tall (centered
// horizontally, sitting low). The SVG carries ~1% internal padding around its ink inside the
// 904x540 viewBox, so the svg box is inflated to match: positioning the box here lands the visible
// logo exactly on the raster's, at the same scale and spot. Aspect 89.22/53.3 = the viewBox aspect,
// so xMidYMid meet fills it with no letterbox.
const LOGO = { left: "4.93%", top: "36.0%", width: "89.22%", height: "53.3%" };

export function CoverArt({
  src,
  alt,
  className = "",
  eager = false,
  image,
}: {
  /** The item's own artwork. When absent (the default cover), the SVG-on-violet square renders. */
  src?: string | null;
  alt: string;
  /** The frame: gm-cover-bordered or gm-cover-ringed (site.css). */
  className?: string;
  eager?: boolean;
  /** The artwork's sizes from /media, when the loader could size it. */
  image?: ImageAttributes;
}) {
  const [failed, setFailed] = useState(false);
  const holder = useRef<HTMLSpanElement | null>(null);

  // An image's error event does not bubble, so the wrapper listens in the capture phase; one that failed before this
  // ran (the page was server-rendered) is seen by its size.
  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const fail = () => setFailed(true);
    el.addEventListener("error", fail, true);
    const img = el.querySelector("img");
    if (img?.complete && img.naturalWidth === 0) fail();
    return () => el.removeEventListener("error", fail, true);
  }, [src, failed]);

  // Per-item raster wins; fall through to the SVG square if it 404s or fails to decode.
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
