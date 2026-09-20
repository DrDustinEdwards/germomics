// Ambient brand equalizer for the home hero. Pure CSS, no JS, no audio input: a continuous
// decorative loop that is already animating on load and is never started or stopped by the
// player. It echoes the episode waveform's bar language (rounded-sm corners, gap-px spacing,
// the --accent token via bg-accent so it flips with data-theme), but it is a separate, simpler
// component and is NOT wired to any peak data or playback state. The real audio-reactive
// waveform stays on the episode pages; this is brand texture only.
//
// Accessibility: aria-hidden, not focusable, no role. It carries no information and is never
// the only path to anything. Reduced motion is handled globally in app.css (prefers-reduced-
// motion sets animation: none on everything), which freezes the bars to their resting row.

// 28 bars, each described by three numbers. The combination is the point, and each part of it
// is a settled decision from an earlier round on this component:
//
// `top` IS THE BAR'S CEILING, as a percentage of the row. MOST BARS ARE 100 and reach the full
// height; a scattered minority top out lower and never make it up there. A version where every
// bar had its own lower ceiling made the row wear a fixed shape, and a version where all 28
// reached 100 lost the character of the short ones. The mix is deliberate: keep both, with the
// full-height bars in the majority.
//
// `lo` IS THE BOTTOM OF ITS TRAVEL, as a fraction of its own ceiling, fed to the shared
// keyframes as a CSS variable. It is what makes two bars with the same ceiling move differently.
//
// TIMING STAYS INDEPENDENT. Each bar keeps its own duration and an unrelated delay, so no crest
// travels along the row. A version with one shared duration and evenly stepped delays produced
// exactly that marching wave and was rejected; do not reintroduce a delay computed from the
// index, and keep neighbouring durations different.
//
// Fixed values throughout, never Math.random, so the server and client render identically.
//
// WIDTH COMES FROM THE COUNT. Every bar is flex-1 inside the fixed-width shelf below, so each is
// (shelf - gaps) / BARS.length wide. This list's length is the only thing that sets bar
// thickness; there is no width value to edit.
const BARS: { top: number; lo: number; dur: string; delay: string }[] = [
  { top: 100, lo: 0.32, dur: "3.0s", delay: "-0.40s" },
  { top: 72, lo: 0.18, dur: "2.6s", delay: "-2.10s" },
  { top: 100, lo: 0.44, dur: "3.6s", delay: "-2.20s" },
  { top: 100, lo: 0.26, dur: "3.2s", delay: "-0.70s" },
  { top: 58, lo: 0.38, dur: "2.6s", delay: "-1.20s" },
  { top: 100, lo: 0.15, dur: "3.8s", delay: "-2.90s" },
  { top: 88, lo: 0.48, dur: "4.0s", delay: "-3.00s" },
  { top: 100, lo: 0.3, dur: "2.4s", delay: "-0.50s" },
  { top: 100, lo: 0.22, dur: "3.2s", delay: "-0.60s" },
  { top: 64, lo: 0.41, dur: "3.4s", delay: "-3.40s" },
  { top: 100, lo: 0.34, dur: "2.8s", delay: "-1.80s" },
  { top: 100, lo: 0.19, dur: "4.0s", delay: "-1.10s" },
  { top: 46, lo: 0.45, dur: "3.8s", delay: "-3.60s" },
  { top: 100, lo: 0.28, dur: "3.0s", delay: "-2.50s" },
  { top: 82, lo: 0.36, dur: "2.4s", delay: "-1.00s" },
  { top: 100, lo: 0.16, dur: "3.6s", delay: "-1.50s" },
  { top: 100, lo: 0.43, dur: "3.4s", delay: "-2.60s" },
  { top: 68, lo: 0.25, dur: "2.6s", delay: "-0.30s" },
  { top: 100, lo: 0.39, dur: "3.0s", delay: "-1.40s" },
  { top: 54, lo: 0.21, dur: "4.0s", delay: "-3.90s" },
  { top: 100, lo: 0.47, dur: "4.0s", delay: "-3.20s" },
  { top: 100, lo: 0.33, dur: "2.8s", delay: "-0.90s" },
  { top: 90, lo: 0.17, dur: "2.8s", delay: "-0.80s" },
  { top: 100, lo: 0.42, dur: "3.8s", delay: "-2.30s" },
  { top: 76, lo: 0.29, dur: "3.6s", delay: "-2.00s" },
  { top: 100, lo: 0.37, dur: "3.2s", delay: "-1.30s" },
  { top: 100, lo: 0.24, dur: "3.2s", delay: "-1.60s" },
  { top: 62, lo: 0.46, dur: "2.4s", delay: "-2.80s" },
];

export function HeroEqualizer() {
  return (
    <div
      aria-hidden="true"
      // Same row as the episode waveform (EpisodeWaveform.tsx): flex, h-16, items-center, gap-px.
      // Hidden below sm so it never crowds the headline on phones; the cover above it carries the
      // right column there.
      className="hidden h-16 w-44 items-center gap-px sm:flex sm:w-52"
    >
      {/* Keyframes live with the component so it stays self-contained. scaleY from the default
          center origin grows each bar symmetrically around the centerline, the way the player
          waveform renders. --lo is read per bar, which is how one shared rule gives 28 different
          travel distances. */}
      <style>{"@keyframes germomics-eq{from{transform:scaleY(var(--lo,0.3))}to{transform:scaleY(1)}}"}</style>
      {BARS.map((b, i) => (
        <span
          key={i}
          // The waveform's exact bar classes: relative, flex-1 (identical width, never a fixed
          // width), rounded-sm, bg-accent.
          className="relative flex-1 rounded-sm bg-accent"
          style={
            {
              "--lo": b.lo,
              height: `${b.top}%`,
              // Resting state (also what shows when reduced motion freezes the animation).
              transform: `scaleY(${b.lo})`,
              animation: `germomics-eq ${b.dur} ease-in-out ${b.delay} infinite alternate`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
