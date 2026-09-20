// Ambient brand equalizer for the home hero. Pure CSS, no JS, no audio input: a continuous
// decorative loop that is already animating on load and is never started or stopped by the
// player. It deliberately echoes the episode waveform's bar language (rounded-sm corners,
// gap-px spacing, the --accent token via bg-accent so it flips with data-theme), but it is a
// separate, simpler component and is NOT wired to any peak data or playback state. The real
// audio-reactive waveform stays on the episode pages; this is brand texture only.
//
// Accessibility: aria-hidden, not focusable, no role. It carries no information and is never
// the only path to anything. Reduced motion is handled globally in app.css (prefers-reduced-
// motion sets animation: none on everything), which freezes the bars to their resting row.

// 28 bars, matched to how EpisodeWaveform.tsx renders: a per-bar HEIGHT percentage around a
// shared centerline, so the row reads as a waveform silhouette rather than a block of even
// slabs. Two things are being matched deliberately:
//
// WIDTH comes from the count, not from a width value. Every bar is flex-1 inside the
// fixed-width shelf below, so each is (shelf - gaps) / BARS.length wide. 28 bars in w-52 lands
// within a pixel of the player waveform's own bar width (120 bars across the episode player),
// which is why this list is the thing to edit if the bars ever look wrong again.
//
// HEIGHTS are a fixed hand-tuned pattern, not Math.random and not the sine fallback
// EpisodeWaveform uses: that formula undersampled at 28 bars clamps repeatedly to its floor and
// reads as dropouts. These sit mostly mid-height with two peaks, the shape a real episode makes.
// Fixed values also keep the server and client renders identical.
//
// The animation now only nudges each bar (scaleY 0.82 to 1) instead of driving the whole height,
// so the silhouette above stays legible while the row still moves.
const BARS: { h: number; dur: string; delay: string }[] = [
  { h: 52, dur: "1.5s", delay: "-0.20s" },
  { h: 61, dur: "1.3s", delay: "-1.05s" },
  { h: 44, dur: "1.8s", delay: "-1.10s" },
  { h: 70, dur: "1.6s", delay: "-0.35s" },
  { h: 48, dur: "1.3s", delay: "-0.60s" },
  { h: 38, dur: "1.9s", delay: "-1.45s" },
  { h: 58, dur: "2.0s", delay: "-1.50s" },
  { h: 92, dur: "1.2s", delay: "-0.25s" },
  { h: 46, dur: "1.6s", delay: "-0.30s" },
  { h: 55, dur: "1.7s", delay: "-1.70s" },
  { h: 40, dur: "1.4s", delay: "-0.90s" },
  { h: 66, dur: "2.0s", delay: "-0.55s" },
  { h: 50, dur: "1.9s", delay: "-1.80s" },
  { h: 36, dur: "1.5s", delay: "-1.25s" },
  { h: 62, dur: "1.2s", delay: "-0.50s" },
  { h: 44, dur: "1.8s", delay: "-0.75s" },
  { h: 88, dur: "1.7s", delay: "-1.30s" },
  { h: 52, dur: "1.3s", delay: "-0.15s" },
  { h: 41, dur: "1.5s", delay: "-0.70s" },
  { h: 58, dur: "2.0s", delay: "-1.95s" },
  { h: 47, dur: "2.0s", delay: "-1.60s" },
  { h: 70, dur: "1.4s", delay: "-0.45s" },
  { h: 39, dur: "1.4s", delay: "-0.40s" },
  { h: 54, dur: "1.9s", delay: "-1.15s" },
  { h: 64, dur: "1.8s", delay: "-1.00s" },
  { h: 43, dur: "1.6s", delay: "-0.65s" },
  { h: 57, dur: "1.6s", delay: "-0.80s" },
  { h: 49, dur: "1.2s", delay: "-1.40s" },
];

export function HeroEqualizer() {
  return (
    <div
      aria-hidden="true"
      // Same row as the episode waveform (EpisodeWaveform.tsx): flex, h-16, items-center, gap-px.
      // The 28 flex-1 bars evenly fill this fixed-width shelf under the cover, so every bar gets an
      // identical computed width (no hardcoded bar width). Hidden below sm so it never crowds the
      // headline on phones; the cover above it carries the right column there.
      className="hidden h-16 w-44 items-center gap-px sm:flex sm:w-52"
    >
      {/* Keyframes live with the component so it stays self-contained. scaleY from the default
          center origin grows each bar symmetrically around the centerline, the way the player
          waveform renders. The range is narrow on purpose: each bar's own height carries the
          waveform shape, and the animation only breathes around it. */}
      <style>{"@keyframes germomics-eq{from{transform:scaleY(0.82)}to{transform:scaleY(1)}}"}</style>
      {BARS.map((b, i) => (
        <span
          key={i}
          // The waveform's exact bar classes: relative, flex-1 (identical width, never a fixed
          // width), rounded-sm, bg-accent. Height is per-bar, as in EpisodeWaveform.
          className="relative flex-1 rounded-sm bg-accent"
          style={{
            height: `${b.h}%`,
            // Resting state (also what shows when reduced motion freezes the animation).
            transform: "scaleY(0.92)",
            animation: `germomics-eq ${b.dur} ease-in-out ${b.delay} infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}
