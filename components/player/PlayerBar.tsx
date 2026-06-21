'use client';

import Link from 'next/link';
import { Pause, Play, SkipBack, SkipForward, RotateCcw, RotateCw } from 'lucide-react';
import { usePlayer } from '@/components/player/PlayerProvider';
import { SPEEDS } from '@/lib/player';
import { hms } from '@/lib/format';

export default function PlayerBar() {
  const p = usePlayer();
  if (!p.current) return null;

  return (
    <div
      role="region"
      aria-label="Audio player"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <Link href={p.current.href} className="block truncate font-display text-sm font-medium text-text-primary">
            {p.current.title}
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-xs tabular-nums text-text-tertiary">{hms(p.currentTime)}</span>
            <input
              type="range"
              min={0}
              max={Math.max(1, Math.floor(p.duration))}
              value={Math.floor(p.currentTime)}
              onChange={(e) => p.seek(Number(e.target.value))}
              aria-label="Seek"
              className="h-1 flex-1 cursor-pointer accent-[var(--accent)]"
            />
            <span className="font-mono text-xs tabular-nums text-text-tertiary">{hms(p.duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1">
          <Ctrl label="Back 15 seconds" onClick={() => p.skip(-15)}><RotateCcw size={18} aria-hidden /></Ctrl>
          <Ctrl label="Previous" onClick={p.prev}><SkipBack size={18} aria-hidden /></Ctrl>
          <button
            type="button"
            onClick={p.toggle}
            aria-label={p.isPlaying ? 'Pause' : 'Play'}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-on-accent"
          >
            {p.isPlaying ? <Pause size={20} aria-hidden /> : <Play size={20} aria-hidden />}
          </button>
          <Ctrl label="Next" onClick={p.next}><SkipForward size={18} aria-hidden /></Ctrl>
          <Ctrl label="Forward 30 seconds" onClick={() => p.skip(30)}><RotateCw size={18} aria-hidden /></Ctrl>

          <label className="sr-only" htmlFor="player-speed">Playback speed</label>
          <select
            id="player-speed"
            value={p.rate}
            onChange={(e) => p.setRate(Number(e.target.value))}
            className="ml-1 rounded-full border border-border bg-card px-2 py-1 font-mono text-xs text-text-secondary"
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>{s}×</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

function Ctrl({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-10 w-10 items-center justify-center rounded-full text-text-secondary transition-colors hover:text-text-primary"
    >
      {children}
    </button>
  );
}
