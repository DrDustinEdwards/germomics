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

// 40 bars. Three decisions, all of them revisions of earlier versions of this file:
//
// EVERY BAR REACHES THE TOP. Previously each bar had its own fixed height percentage, so some
// could only ever rise partway and the row had a permanent ceiling shape. Now every bar is
// h-full and the per-bar difference is how FAR DOWN it starts: LOWS[i] is the bottom of its
// travel, fed into the keyframes as a CSS variable. Every bar still tops out at full height,
// just with a different amount of travel to get there.
//
// THE PHASE IS A WAVE, NOT NOISE. Every bar shares one duration and its delay steps evenly
// across the row, so a crest travels along it instead of 40 bars twitching independently. The
// step is set so exactly one full up-and-down is visible end to end. An earlier version of this
// file deliberately avoided a synchronised row; that was when it was meant to read as ambient
// texture, and the brief since then is explicitly soundwave-like.
//
// WIDTH COMES FROM THE COUNT. Every bar is flex-1 inside the fixed-width shelf below, so each
// is (shelf - gaps) / BARS wide. This list length is the only thing that sets bar thickness;
// there is no width value to edit.
const BARS = 40;

// Seconds for one sweep. With `alternate` the full cycle is twice this.
const DUR = 3.2;
// Per-bar delay step. BARS * STEP == DUR * 2 puts exactly one whole wave across the row.
const STEP = (DUR * 2) / BARS;

// The bottom of each bar's travel, 0..1. Fixed values, not Math.random, so the server and
// client render identically. The spread is what keeps the crest ragged rather than a smooth
// sine: bars with a lower floor swing further and read as the loud parts of a waveform.
const LOWS = [
  0.32, 0.18, 0.44, 0.26, 0.38, 0.15, 0.48, 0.3, 0.22, 0.41, 0.34, 0.19, 0.45, 0.28, 0.36, 0.16,
  0.43, 0.25, 0.39, 0.21, 0.47, 0.33, 0.17, 0.42, 0.29, 0.37, 0.24, 0.46, 0.31, 0.2, 0.4, 0.27,
  0.35, 0.14, 0.44, 0.23, 0.38, 0.3, 0.18, 0.42,
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
          waveform renders. --lo is read per bar, which is how one shared keyframe rule gives
          40 different travel distances that all end at the same full height. */}
      <style>{"@keyframes germomics-eq{from{transform:scaleY(var(--lo,0.3))}to{transform:scaleY(1)}}"}</style>
      {LOWS.map((lo, i) => (
        <span
          key={i}
          // The waveform's exact bar classes: relative, flex-1 (identical width, never a fixed
          // width), rounded-sm, bg-accent. h-full is the shared ceiling every bar reaches.
          className="relative h-full flex-1 rounded-sm bg-accent"
          style={
            {
              "--lo": lo,
              // Resting state (also what shows when reduced motion freezes the animation).
              transform: `scaleY(${lo})`,
              animation: `germomics-eq ${DUR}s ease-in-out -${(i * STEP).toFixed(2)}s infinite alternate`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
