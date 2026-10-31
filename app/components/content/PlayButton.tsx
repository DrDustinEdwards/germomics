import { Play, Pause } from "lucide-react";
import { usePlayer } from "~/components/player/player-context";
import type { PlayerTrack } from "~/lib/types";

// Plays a track. If a queue is supplied (a listing/home), it starts the whole queue at this
// track so playback continues episode-to-episode; otherwise it plays the single track.
// On a page that sends no React, a press first hydrates the page and is then handed to this button
// (data-play-intent, app/site/hydrate.ts); data-audio-src lets that press unlock the <audio> element.
export function PlayButton({
  track,
  queue,
  size = "md",
}: {
  track: PlayerTrack;
  queue?: PlayerTrack[];
  size?: "sm" | "md" | "lg";
}) {
  const p = usePlayer();
  const isCurrent = p.current?.id === track.id;
  const playing = isCurrent && p.isPlaying;
  const dims = size === "lg" ? "h-12 w-12" : size === "sm" ? "h-8 w-8" : "h-10 w-10";

  const onClick = () => {
    if (isCurrent) return p.toggle();
    if (queue?.length) {
      const idx = queue.findIndex((t) => t.id === track.id);
      p.playQueueAt(queue, idx >= 0 ? idx : 0);
    } else {
      p.playTrack(track);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      data-play-intent=""
      data-audio-src={track.audioUrl}
      aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
      aria-pressed={playing}
      className={`grid ${dims} shrink-0 place-items-center rounded-full bg-accent text-bg transition hover:brightness-110`}
    >
      {playing ? <Pause size={18} aria-hidden /> : <Play size={18} aria-hidden />}
    </button>
  );
}
