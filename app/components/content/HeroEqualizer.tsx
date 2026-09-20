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

// 28 bars. Three decisions, each one a revision of an earlier version of this file:
//
// EVERY BAR REACHES THE TOP. Previously each bar had its own fixed height percentage, so some
// could only ever rise partway and the row wore a permanent ceiling shape. Now every bar is
// h-full and the per-bar difference is how far DOWN it starts: `lo` is the bottom of its
// travel, fed into the shared keyframes as a CSS variable. Same ceiling for all, different
// distances to it.
//
// TIMING STAYS INDEPENDENT. Each bar keeps its own duration and an unrelated delay, so no crest
// travels along the row. A version with one shared duration and evenly stepped delays produced
// exactly that marching wave and was rejected; do not reintroduce a delay computed from the
// index.
//
// WIDTH COMES FROM THE COUNT. Every bar is flex-1 inside the fixed-width shelf below, so each is
// (shelf - gaps) / BARS.length wide. This list's length is the only thing that sets bar
// thickness; there is no width value to edit.
const BARS: { lo: number; dur: string; delay: string }[] = [
  { lo: 0.32, dur: "3.0s", delay: "-0.40s" },
  { lo: 0.18, dur: "2.6s", delay: "-2.10s" },
  { lo: 0.44, dur: "3.6s", delay: "-2.20s" },
  { lo: 0.26, dur: "3.2s", delay: "-0.70s" },
  { lo: 0.38, dur: "2.6s", delay: "-1.20s" },
  { lo: 0.15, dur: "3.8s", delay: "-2.90s" },
  { lo: 0.48, dur: "4.0s", delay: "-3.00s" },
  { lo: 0.3, dur: "2.4s", delay: "-0.50s" },
  { lo: 0.22, dur: "3.2s", delay: "-0.60s" },
  { lo: 0.41, dur: "3.4s", delay: "-3.40s" },
  { lo: 0.34, dur: "2.8s", delay: "-1.80s" },
  { lo: 0.19, dur: "4.0s", delay: "-1.10s" },
  { lo: 0.45, dur: "3.8s", delay: "-3.60s" },
  { lo: 0.28, dur: "3.0s", delay: "-2.50s" },
  { lo: 0.36, dur: "2.4s", delay: "-1.00s" },
  { lo: 0.16, dur: "3.6s", delay: "-1.50s" },
  { lo: 0.43, dur: "3.4s", delay: "-2.60s" },
  { lo: 0.25, dur: "2.6s", delay: "-0.30s" },
  { lo: 0.39, dur: "3.0s", delay: "-1.40s" },
  { lo: 0.21, dur: "4.0s", delay: "-3.90s" },
  { lo: 0.47, dur: "4.0s", delay: "-3.20s" },
  { lo: 0.33, dur: "2.8s", delay: "-0.90s" },
  { lo: 0.17, dur: "2.8s", delay: "-0.80s" },
  { lo: 0.42, dur: "3.8s", delay: "-2.30s" },
  { lo: 0.29, dur: "3.6s", delay: "-2.00s" },
  { lo: 0.37, dur: "3.2s", delay: "-1.30s" },
  { lo: 0.24, dur: "3.2s", delay: "-1.60s" },
  { lo: 0.46, dur: "2.4s", delay: "-2.80s" },
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
          travel distances that all end at the same full height. */}
      <style>{"@keyframes germomics-eq{from{transform:scaleY(var(--lo,0.3))}to{transform:scaleY(1)}}"}</style>
      {BARS.map((b, i) => (
        <span
          key={i}
          // The waveform's exact bar classes: relative, flex-1 (identical width, never a fixed
          // width), rounded-sm, bg-accent. h-full is the shared ceiling every bar reaches.
          className="relative h-full flex-1 rounded-sm bg-accent"
          style={
            {
              "--lo": b.lo,
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
