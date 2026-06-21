'use client';

import { Pause, Play } from 'lucide-react';
import { usePlayer } from '@/components/player/PlayerProvider';
import type { Track } from '@/lib/player';

/**
 * Play a single track, or (when `queue` is given) play the whole queue starting at this
 * track. "Play this" on an episode page; "Play all" / row buttons in listings.
 */
export default function PlayButton({
  track,
  queue,
  label,
  className,
}: {
  track: Track;
  queue?: Track[];
  label?: string;
  className?: string;
}) {
  const p = usePlayer();
  const isCurrent = p.current?.id === track.id;
  const isThisPlaying = isCurrent && p.isPlaying;

  function onClick() {
    if (isCurrent) {
      p.toggle();
      return;
    }
    if (queue && queue.length) {
      const start = Math.max(0, queue.findIndex((t) => t.id === track.id));
      p.playQueue(queue, start);
    } else {
      p.playTrack(track);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isThisPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
      className={
        className ??
        'inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 font-display text-sm font-medium text-on-accent transition-opacity hover:opacity-90'
      }
    >
      {isThisPlaying ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
      {label ?? (isThisPlaying ? 'Pause' : 'Play')}
    </button>
  );
}
