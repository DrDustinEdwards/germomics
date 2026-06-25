// Visual waveform for the episode player surface. Code-split (lazy) so its only loads on the single
// episode route and never enters the shared client chunk. This is a pointer-only enhancement and is
// aria-hidden: the accessible seek control is the native range slider in EpisodePlayerSurface, so the
// waveform is never the only way to seek (WCAG 2.2 SC 2.5.7 / 2.4.11). Played portion fills in brand,
// the leading edge is bright, and the chapter currently playing tints cyan (now-playing = cyan only).
import { useMemo, useRef, useState } from "react";

const BARS = 120;

// Accepts peaks as 0..1 floats or 0..100 ints; falls back to a calm synthetic pattern when absent so
// the surface is never empty for migrated episodes that have no stored peaks yet.
function normalize(peaks: number[] | null | undefined): number[] {
  if (peaks && peaks.length) {
    const max = peaks.reduce((m, p) => (p > m ? p : m), 0) || 1;
    const scale = max > 1 ? 100 : 1;
    const src = peaks;
    const step = src.length / BARS;
    return Array.from({ length: BARS }, (_, i) => {
      const v = src[Math.min(src.length - 1, Math.floor(i * step))] ?? 0;
      return Math.min(1, Math.max(0.04, v / scale));
    });
  }
  // Synthetic fallback: two overlaid sines give a gentle, non-flat shape without implying real data.
  return Array.from({ length: BARS }, (_, i) => {
    const t = i / BARS;
    const v = 0.32 + 0.22 * Math.sin(t * Math.PI * 9) + 0.16 * Math.sin(t * Math.PI * 23 + 1.7);
    return Math.min(1, Math.max(0.08, Math.abs(v)));
  });
}

function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function EpisodeWaveform({
  peaks,
  positionFrac,
  durationSec,
  activeRegion,
  onSeekFrac,
  synthetic,
}: {
  peaks: number[] | null;
  positionFrac: number;
  durationSec: number;
  /** Fractional [start,end] of the chapter currently playing, tinted cyan. */
  activeRegion?: [number, number] | null;
  onSeekFrac: (frac: number) => void;
  synthetic?: boolean;
}) {
  const bars = useMemo(() => normalize(peaks), [peaks]);
  const ref = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<{ frac: number; x: number } | null>(null);

  const fracFromX = (clientX: number) => {
    const el = ref.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };

  return (
    <div className="relative">
      <div
        ref={ref}
        aria-hidden
        onClick={(e) => onSeekFrac(fracFromX(e.clientX))}
        onMouseMove={(e) => setHover({ frac: fracFromX(e.clientX), x: e.clientX - (ref.current?.getBoundingClientRect().left ?? 0) })}
        onMouseLeave={() => setHover(null)}
        className="relative flex h-16 cursor-pointer items-center gap-px overflow-hidden rounded-lg"
      >
        {activeRegion ? (
          <span
            className="pointer-events-none absolute inset-y-0 bg-accent/12"
            style={{ left: `${activeRegion[0] * 100}%`, width: `${Math.max(0, (activeRegion[1] - activeRegion[0]) * 100)}%` }}
          />
        ) : null}
        {bars.map((h, i) => {
          const frac = (i + 0.5) / BARS;
          const played = frac <= positionFrac;
          const leading = Math.abs(frac - positionFrac) < 1 / BARS;
          const inRegion = !!activeRegion && frac >= activeRegion[0] && frac < activeRegion[1];
          const color = leading
            ? "bg-brand"
            : played
              ? inRegion
                ? "bg-accent/80"
                : "bg-brand/70"
              : "bg-muted/30";
          return (
            <span
              key={i}
              className={`relative flex-1 rounded-sm ${color}`}
              style={{ height: `${Math.round(h * 100)}%` }}
            />
          );
        })}
        {hover ? (
          <span
            className="pointer-events-none absolute -top-7 z-10 -translate-x-1/2 rounded bg-ink px-1.5 py-0.5 font-mono text-[11px] text-bg"
            style={{ left: hover.x }}
          >
            {fmt(hover.frac * durationSec)}
          </span>
        ) : null}
      </div>
      {synthetic ? (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-muted/70">
          Waveform preview
        </p>
      ) : null}
    </div>
  );
}
