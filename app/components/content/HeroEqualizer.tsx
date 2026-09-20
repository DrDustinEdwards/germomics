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

// 28 bars. EVERY BAR OWNS BOTH ENDS OF ITS TRAVEL: `lo` is where it starts, `hi` is where it
// stops, each a fraction of the row's full height. Nothing is shared between bars, so a bar can
// rise from the floor to the ceiling, hover in a narrow band in the middle, or top out partway
// and never reach the top.
//
// Getting here took several rounds, and each rejected version is worth naming so it does not
// come back:
//   - every bar with its own fixed HEIGHT, scaled from one shared floor: the row wore a
//     permanent shape, since a short bar could never rise.
//   - every bar reaching the SAME ceiling: lost the character of the ones that stop early.
//   - a mix of full-height and short bars, still all bottoming out together: closer, but the
//     starts were still uniform, which is the other half of what makes it read as mechanical.
// The current form is the general case those three were each a special case of.
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
const BARS: { lo: number; hi: number; dur: string; delay: string }[] = [
  { lo: 0.3, hi: 1.0, dur: "3.0s", delay: "-0.40s" },
  { lo: 0.14, hi: 0.62, dur: "2.6s", delay: "-2.10s" },
  { lo: 0.45, hi: 1.0, dur: "3.6s", delay: "-2.20s" },
  { lo: 0.22, hi: 0.88, dur: "3.2s", delay: "-0.70s" },
  { lo: 0.38, hi: 0.7, dur: "2.6s", delay: "-1.20s" },
  { lo: 0.12, hi: 1.0, dur: "3.8s", delay: "-2.90s" },
  { lo: 0.5, hi: 0.92, dur: "4.0s", delay: "-3.00s" },
  { lo: 0.26, hi: 0.78, dur: "2.4s", delay: "-0.50s" },
  { lo: 0.18, hi: 1.0, dur: "3.2s", delay: "-0.60s" },
  { lo: 0.42, hi: 0.66, dur: "3.4s", delay: "-3.40s" },
  { lo: 0.34, hi: 0.96, dur: "2.8s", delay: "-1.80s" },
  { lo: 0.16, hi: 0.84, dur: "4.0s", delay: "-1.10s" },
  { lo: 0.46, hi: 0.58, dur: "3.8s", delay: "-3.60s" },
  { lo: 0.28, hi: 1.0, dur: "3.0s", delay: "-2.50s" },
  { lo: 0.2, hi: 0.74, dur: "2.4s", delay: "-1.00s" },
  { lo: 0.36, hi: 0.9, dur: "3.6s", delay: "-1.50s" },
  { lo: 0.13, hi: 1.0, dur: "3.4s", delay: "-2.60s" },
  { lo: 0.48, hi: 0.8, dur: "2.6s", delay: "-0.30s" },
  { lo: 0.24, hi: 0.68, dur: "3.0s", delay: "-1.40s" },
  { lo: 0.4, hi: 1.0, dur: "4.0s", delay: "-3.90s" },
  { lo: 0.15, hi: 0.86, dur: "4.0s", delay: "-3.20s" },
  { lo: 0.32, hi: 0.6, dur: "2.8s", delay: "-0.90s" },
  { lo: 0.44, hi: 0.94, dur: "2.8s", delay: "-0.80s" },
  { lo: 0.19, hi: 1.0, dur: "3.8s", delay: "-2.30s" },
  { lo: 0.29, hi: 0.72, dur: "3.6s", delay: "-2.00s" },
  { lo: 0.37, hi: 0.98, dur: "3.2s", delay: "-1.30s" },
  { lo: 0.21, hi: 0.64, dur: "3.2s", delay: "-1.60s" },
  { lo: 0.47, hi: 0.82, dur: "2.4s", delay: "-2.80s" },
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
          waveform renders. Both ends read a CSS variable, which is how one shared rule gives 28
          independent travel ranges without 28 keyframe blocks. */}
      <style>{"@keyframes germomics-eq{from{transform:scaleY(var(--lo,0.3))}to{transform:scaleY(var(--hi,1))}}"}</style>
      {BARS.map((b, i) => (
        <span
          key={i}
          // The waveform's exact bar classes: relative, flex-1 (identical width, never a fixed
          // width), rounded-sm, bg-accent. h-full is the shelf height every bar scales within.
          className="relative h-full flex-1 rounded-sm bg-accent"
          style={
            {
              "--lo": b.lo,
              "--hi": b.hi,
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
