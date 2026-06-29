import type { CSSProperties } from "react";

// Decorative hero backdrop: a few large, heavily blurred radial blobs in brand tokens that drift
// slowly, reading as out-of-focus microbial colonies behind the words. Purely ambient: aria-hidden,
// pointer-events-none, carries no information. Token-driven (bg-brand / bg-accent) so it flips with
// data-theme. In dark mode the brand token is a light lavender, so the whole group is dimmed to keep
// it as quiet texture instead of a glow. Reduced motion is handled by the global app.css rule
// (animation: none), which holds every blob still.

type Blob = {
  color: string;
  top: string;
  left: string;
  size: string;
  dx: string;
  dy: string;
  s: string;
  dur: string;
  delay: string;
};

// 3 brand tints + 1 faint accent. The layer spans the full page width (see below) and the bottom
// dissolves via a mask, so positions are measured against the viewport. Durations 26s to 38s with
// varied negative delays so the drift never syncs. The dense cores are weighted to the corners and
// the right (the cover side), not behind the left text column, so the h1 and lede keep their
// contrast in both themes; only faint blurred tails reach the words. Adjust positions/opacity here
// (never the text) if needed.
const BLOBS: Blob[] = [
  { color: "bg-brand/30", top: "-30%", left: "-10%", size: "26rem", dx: "26px", dy: "20px", s: "1.12", dur: "30s", delay: "-4s" },
  { color: "bg-brand/25", top: "16%", left: "64%", size: "28rem", dx: "-30px", dy: "16px", s: "1.10", dur: "36s", delay: "-12s" },
  { color: "bg-brand/20", top: "-22%", left: "72%", size: "22rem", dx: "18px", dy: "-22px", s: "1.14", dur: "26s", delay: "-8s" },
  { color: "bg-accent/20", top: "46%", left: "60%", size: "24rem", dx: "-20px", dy: "-18px", s: "1.08", dur: "38s", delay: "-2s" },
];

export function HeroBackground() {
  return (
    <div
      aria-hidden="true"
      className="hero-blobs pointer-events-none absolute"
      style={{
        top: 0,
        bottom: 0,
        // Full-bleed to the viewport width WITHOUT 100vw: these insets pull the layer's edges from
        // inside the centered content wrap out to the screen edges. overflow-x: clip on <html>
        // (app.css) guards against any subpixel horizontal scrollbar. No border, no rounding, no
        // overflow clip, so the wash no longer reads as a bordered banner box.
        left: "calc(50% - 50vw)",
        right: "calc(50% - 50vw)",
        // Dissolve into the page at the bottom instead of ending on a hard line. no-repeat keeps the
        // single gradient sized to the box, so it also clips the blobs that overflow the top/sides.
        WebkitMaskImage: "linear-gradient(to bottom, black 56%, transparent 86%)",
        maskImage: "linear-gradient(to bottom, black 56%, transparent 86%)",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
      }}
    >
      {/* Self-contained: theme-aware group opacity (dimmer in dark) and the shared drift keyframe.
          Each blob parameterizes the drift with its own --dx/--dy/--s so one keyframe serves all. */}
      <style>{`.hero-blobs{opacity:0.6}
:root[data-theme="dark"] .hero-blobs{opacity:0.35}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .hero-blobs{opacity:0.35}}
@keyframes germomics-drift{from{transform:translate3d(0,0,0) scale(1)}to{transform:translate3d(var(--dx,0),var(--dy,0),0) scale(var(--s,1))}}`}</style>
      {BLOBS.map((b, i) => (
        <span
          key={i}
          className={`absolute rounded-full blur-3xl ${b.color}`}
          style={
            {
              top: b.top,
              left: b.left,
              width: b.size,
              height: b.size,
              "--dx": b.dx,
              "--dy": b.dy,
              "--s": b.s,
              animation: `germomics-drift ${b.dur} ease-in-out ${b.delay} infinite alternate`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
