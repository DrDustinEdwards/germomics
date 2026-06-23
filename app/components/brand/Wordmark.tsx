// Full germomics wordmark (the mic forms the M). Rendered inline from the source SVG via ?raw, so it
// inherits the surrounding text color through currentColor and can never drift from the artwork the way
// hand-copied path data did (the old inline copy was truncated before the mic glyph and read "GER OMICS").
// Source of truth: ./germomics-wordmark.svg (mirrors public/brand/germomics-wordmark-currentcolor.svg).
import markup from "./germomics-wordmark.svg?raw";

export function Wordmark({
  className = "",
  title = "Germomics",
}: {
  className?: string;
  title?: string;
}) {
  // The wrapper carries the accessible name and the brand color; the inner <svg> (aria-hidden) keeps
  // its viewBox. Height comes from `className` (e.g. h-8) and the width follows the intrinsic ratio.
  return (
    <span
      role="img"
      aria-label={title}
      className={`inline-flex text-brand [&>svg]:h-full [&>svg]:w-auto ${className}`}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}
