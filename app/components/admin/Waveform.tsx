// Waveform bars from precomputed peaks (0..1). Read-only preview, or interactive for chapter
// scrubbing: click/keyboard sets a fraction (0..1) that the caller maps to a timestamp. Markers
// overlay chapter positions.
import { useRef } from "react";

export function Waveform({
  peaks,
  markers = [],
  onScrub,
  ariaLabel = "Waveform",
  height = 56,
}: {
  peaks: number[];
  markers?: number[]; // fractions 0..1
  onScrub?: (fraction: number) => void;
  ariaLabel?: string;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const interactive = !!onScrub;

  function fractionFromEvent(clientX: number): number {
    const el = ref.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  }

  if (!peaks.length) {
    return (
      <div
        className="grid place-items-center rounded-lg border border-dashed border-border bg-surface text-xs text-muted"
        style={{ height }}
      >
        No waveform yet
      </div>
    );
  }

  return (
    <div
      ref={ref}
      role={interactive ? "slider" : "img"}
      aria-label={ariaLabel}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? 100 : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? (e) => onScrub!(fractionFromEvent(e.clientX)) : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "ArrowRight") onScrub!(Math.min(1, (markers[0] ?? 0) + 0.01));
              if (e.key === "ArrowLeft") onScrub!(Math.max(0, (markers[0] ?? 0) - 0.01));
            }
          : undefined
      }
      className={`relative flex items-end gap-px overflow-hidden rounded-lg border border-border bg-surface px-1 ${
        interactive ? "cursor-crosshair" : ""
      }`}
      style={{ height }}
    >
      {peaks.map((p, i) => (
        <span
          key={i}
          className="flex-1 rounded-sm bg-brand/55"
          style={{ height: `${Math.max(3, p * 100)}%` }}
        />
      ))}
      {markers.map((m, i) => (
        <span
          key={`m${i}`}
          className="absolute top-0 bottom-0 w-px bg-accent"
          style={{ left: `${m * 100}%` }}
          aria-hidden
        />
      ))}
    </div>
  );
}
