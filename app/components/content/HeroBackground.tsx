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

// 3 brand tints + 1 faint accent. Positions bleed past the edges (the wrapper clips with
// overflow-hidden). Durations 26s to 38s with varied negative delays so the drift never syncs.
// The dense cores are deliberately weighted to the top corners and the right (the cover side),
// not behind the left text column, so the h1 and lede keep their contrast in both themes; only
// faint blurred tails reach the words. Adjust positions/opacity here (never the text) if needed.
const BLOBS: Blob[] = [
  { color: "bg-brand/30", top: "-24%", left: "-14%", size: "24rem", dx: "26px", dy: "20px", s: "1.12", dur: "30s", delay: "-4s" },
  { color: "bg-brand/25", top: "22%", left: "60%", size: "26rem", dx: "-30px", dy: "16px", s: "1.10", dur: "36s", delay: "-12s" },
  { color: "bg-brand/20", top: "-16%", left: "66%", size: "20rem", dx: "18px", dy: "-22px", s: "1.14", dur: "26s", delay: "-8s" },
  { color: "bg-accent/20", top: "50%", left: "52%", size: "22rem", dx: "-20px", dy: "-18px", s: "1.08", dur: "38s", delay: "-2s" },
];

export function HeroBackground() {
  return (
    <div aria-hidden="true" className="hero-blobs pointer-events-none absolute inset-0 overflow-hidden">
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
