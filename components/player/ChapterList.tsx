'use client';

import { usePlayer } from '@/components/player/PlayerProvider';
import type { Track } from '@/lib/player';
import type { Chapter } from '@/db/schema';
import { hms } from '@/lib/format';

/** Clickable chapters that load this track (if needed) and jump to the chapter start. */
export default function ChapterList({ track, chapters }: { track: Track; chapters: Chapter[] }) {
  const p = usePlayer();

  function jump(start: number) {
    if (p.current?.id !== track.id) {
      p.playQueue([track], 0);
      // Seek shortly after the source loads.
      window.setTimeout(() => p.seek(start), 350);
    } else {
      p.seek(start);
    }
  }

  return (
    <ol className="divide-y divide-border rounded-2xl border border-border">
      {chapters.map((c, i) => (
        <li key={i}>
          <button
            type="button"
            onClick={() => jump(c.start)}
            className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-surface"
          >
            <span className="font-display text-sm text-text-primary">{c.title}</span>
            <span className="font-mono text-xs tabular-nums text-text-tertiary">{hms(c.start)}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
