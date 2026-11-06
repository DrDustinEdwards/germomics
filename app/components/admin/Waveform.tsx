// Waveform bars from precomputed peaks (ints 0..100, the stored audio_peaks contract), a read-only
// preview. Markers overlay chapter positions.

export function Waveform({
  peaks,
  markers = [],
  ariaLabel = "Waveform",
  height = 56,
}: {
  peaks: number[];
  markers?: number[]; // fractions 0..1
  ariaLabel?: string;
  height?: number;
}) {
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
      role="img"
      aria-label={ariaLabel}
      className="relative flex items-end gap-px overflow-hidden rounded-lg border border-border bg-surface px-1"
      style={{ height }}
    >
      {peaks.map((p, i) => (
        <span
          key={i}
          className="flex-1 rounded-sm bg-brand/55"
          style={{ height: `${Math.max(3, p)}%` }}
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
