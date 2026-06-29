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

// 14 bars, each with a staggered duration (1.2s to 2s) and a negative delay so they start out
// of phase and never read as a synchronized, audio-reactive meter. The values are fixed (no
// Math.random) so the server and client render identically. Bars scale from their default
// center origin, mirroring how the real waveform renders symmetrically around its centerline.
const BARS: { dur: string; delay: string }[] = [
  { dur: "1.5s", delay: "-0.20s" },
  { dur: "1.8s", delay: "-1.10s" },
  { dur: "1.3s", delay: "-0.60s" },
  { dur: "2.0s", delay: "-1.50s" },
  { dur: "1.6s", delay: "-0.30s" },
  { dur: "1.4s", delay: "-0.90s" },
  { dur: "1.9s", delay: "-1.80s" },
  { dur: "1.2s", delay: "-0.50s" },
  { dur: "1.7s", delay: "-1.30s" },
  { dur: "1.5s", delay: "-0.70s" },
  { dur: "2.0s", delay: "-1.60s" },
  { dur: "1.4s", delay: "-0.40s" },
  { dur: "1.8s", delay: "-1.00s" },
  { dur: "1.6s", delay: "-0.80s" },
];

export function HeroEqualizer() {
  return (
    <div
      aria-hidden="true"
      className="flex h-16 items-center justify-center gap-px lg:h-44"
    >
      {/* Keyframes live with the component so it stays self-contained. scaleY from the default
          center origin grows each bar symmetrically up and down. */}
      <style>{"@keyframes germomics-eq{from{transform:scaleY(0.3)}to{transform:scaleY(1)}}"}</style>
      {BARS.map((b, i) => (
        <span
          key={i}
          className="h-full w-[5px] rounded-sm bg-accent"
          style={{
            // Resting state (also what shows when reduced motion freezes the animation).
            transform: "scaleY(0.55)",
            animation: `germomics-eq ${b.dur} ease-in-out ${b.delay} infinite alternate`,
          }}
        />
      ))}
    </div>
  );
}
