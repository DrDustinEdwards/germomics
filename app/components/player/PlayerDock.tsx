// The docked player. Renders only when a track is loaded. Cyan (accent) marks the now-playing
// state. Fully keyboard operable: the seek is a native range input (works with arrow keys, no
// dragging — WCAG 2.5.7), every control is a real button with a name/role/state (4.1.2), and
// targets clear 24px (2.5.8). Sits above content and never covers the focused element (2.4.11).
import { useState } from "react";
import { Link } from "react-router";
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  RotateCw,
  ListTree,
  Gauge,
} from "lucide-react";
import { usePlayer } from "./player-context";
import { formatDuration } from "~/lib/format";

const RATES = [0.8, 1, 1.25, 1.5, 1.75, 2];

export function PlayerDock() {
  const p = usePlayer();
  const [showChapters, setShowChapters] = useState(false);
  if (!p.current) return null;

  const cycleRate = () => {
    const i = RATES.indexOf(p.rate);
    p.setRate(RATES[(i + 1) % RATES.length] ?? 1);
  };

  const chapters = p.current.chapters ?? [];

  return (
    <div
      role="region"
      aria-label="Audio player"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur"
    >
      {showChapters && chapters.length > 0 && (
        <ul className="mx-auto max-h-48 max-w-5xl overflow-y-auto border-b border-border px-4 py-2 text-sm">
          {chapters.map((c, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => p.seek(c.start)}
                className="flex w-full items-center gap-3 rounded px-2 py-1.5 text-left hover:bg-card"
              >
                <span className="font-mono text-xs text-accent">{formatDuration(c.start)}</span>
                <span className="truncate">{c.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
        {/* Now playing */}
        <Link
          to={`/${p.current.slug}`}
          className="min-w-0 flex-1 sm:flex-none sm:w-48"
          title={p.current.title}
        >
          <div className="truncate font-display text-sm font-medium text-ink">
            {p.current.title}
          </div>
          <div className="font-mono text-[11px] uppercase tracking-wide text-accent">
            ● now playing
          </div>
        </Link>

        {/* Transport */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => p.skip(-15)}
            aria-label="Rewind 15 seconds"
            className="tap-target grid place-items-center rounded p-2 hover:text-accent"
          >
            <RotateCcw size={18} aria-hidden />
          </button>
          <button
            type="button"
            onClick={p.toggle}
            aria-label={p.isPlaying ? "Pause" : "Play"}
            aria-pressed={p.isPlaying}
            className="tap-target grid h-10 w-10 place-items-center rounded-full bg-accent text-bg hover:brightness-110"
          >
            {p.isPlaying ? <Pause size={20} aria-hidden /> : <Play size={20} aria-hidden />}
          </button>
          <button
            type="button"
            onClick={() => p.skip(30)}
            aria-label="Skip forward 30 seconds"
            className="tap-target grid place-items-center rounded p-2 hover:text-accent"
          >
            <RotateCw size={18} aria-hidden />
          </button>
          <button
            type="button"
            onClick={p.next}
            disabled={p.index >= p.queue.length - 1}
            aria-label="Next episode"
            className="tap-target grid place-items-center rounded p-2 hover:text-accent disabled:opacity-40"
          >
            <SkipForward size={18} aria-hidden />
          </button>
        </div>

        {/* Seek */}
        <div className="hidden flex-1 items-center gap-2 sm:flex">
          <span className="font-mono text-xs tabular-nums text-muted">
            {formatDuration(p.currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={p.duration || p.current.durationSec || 0}
            value={p.currentTime}
            step={1}
            onChange={(e) => p.seek(Number(e.target.value))}
            aria-label="Seek"
            aria-valuetext={`${formatDuration(p.currentTime)} of ${formatDuration(p.duration)}`}
            className="h-1.5 flex-1 accent-[var(--color-accent)]"
          />
          <span className="font-mono text-xs tabular-nums text-muted">
            {formatDuration(p.duration || p.current.durationSec || 0)}
          </span>
        </div>

        {/* Speed + chapters */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={cycleRate}
            aria-label={`Playback speed ${p.rate}×`}
            className="tap-target flex items-center gap-1 rounded px-2 py-1.5 font-mono text-xs hover:text-accent"
          >
            <Gauge size={15} aria-hidden /> {p.rate}×
          </button>
          {chapters.length > 0 && (
            <button
              type="button"
              onClick={() => setShowChapters((s) => !s)}
              aria-label="Chapters"
              aria-expanded={showChapters}
              className="tap-target grid place-items-center rounded p-2 hover:text-accent"
            >
              <ListTree size={18} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
