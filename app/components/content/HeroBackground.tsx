import type { CSSProperties } from "react";

// Decorative hero backdrop: a few large, heavily blurred radial-gradient blobs that drift slowly,
// reading as out-of-focus microbial colonies behind the words. Purely ambient: aria-hidden,
// pointer-events-none, carries no information. Token-driven (the gradients use var(--brand) /
// var(--accent)) so it flips with data-theme. In dark mode the brand token is a light lavender, so
// the whole group is dimmed to keep it as quiet texture instead of a glow. Reduced motion is handled
// by the global app.css rule (animation: none), which holds every blob still.

type Blob = {
  // Token color expression for the radial center, e.g. var(--brand) / var(--accent).
  color: string;
  // Per-blob center opacity (the tint level). The group is dimmed again in dark mode below.
  op: number;
  top: string;
  left: string;
  size: string;
  dx: string;
  dy: string;
  s: string;
  dur: string;
  delay: string;
};

// 3 brand tints + 1 faint accent. Each blob is a radial-gradient that fades to transparent well
// before its box edge, so it has no boundary anywhere to be clipped against: it just trails off in
// every direction. No mask, no overflow clip. Cores are weighted HIGH in the hero (negative top so
// the dense center sits up near the header) and across the width with the cover side covered, so
// the falloff trails downward and runs out before the "Latest" section, while the lower-left lede
// only catches faint tails and keeps WCAG AA in both themes. The layer spans the full page width
// (see below), so positions read against the viewport. Radial + blur reads fainter than a solid
// fill, so the center opacities are set higher to compensate. Tune positions/opacity by eye here
// (never the text). Durations 26s to 38s with varied negative delays so the drift never syncs.
const BLOBS: Blob[] = [
  { color: "var(--brand)", op: 0.55, top: "-40%", left: "2%", size: "26rem", dx: "26px", dy: "20px", s: "1.12", dur: "30s", delay: "-4s" },
  { color: "var(--brand)", op: 0.5, top: "-44%", left: "48%", size: "30rem", dx: "-30px", dy: "16px", s: "1.10", dur: "36s", delay: "-12s" },
  { color: "var(--brand)", op: 0.42, top: "-28%", left: "26%", size: "24rem", dx: "18px", dy: "-22px", s: "1.14", dur: "26s", delay: "-8s" },
  { color: "var(--accent)", op: 0.38, top: "-36%", left: "70%", size: "26rem", dx: "-20px", dy: "-18px", s: "1.08", dur: "38s", delay: "-2s" },
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
        // (app.css) guards against any subpixel horizontal scrollbar. No border, no rounding, and no
        // overflow clip or mask anywhere, so there is no straight-line cutoff (top or bottom): each
        // blob fades on its own via its radial gradient.
        left: "calc(50% - 50vw)",
        right: "calc(50% - 50vw)",
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
          className="absolute blur-3xl"
          style={
            {
              top: b.top,
              left: b.left,
              width: b.size,
              height: b.size,
              // Radial fade to transparent well inside the box: a soft circle with no edge to clip.
              // Color is the raw token so it flips with data-theme; opacity sets the tint level.
              background: `radial-gradient(circle, ${b.color} 0%, transparent 70%)`,
              opacity: b.op,
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
