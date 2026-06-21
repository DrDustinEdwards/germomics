import { useEffect } from "react";
import { usePlayer } from "~/components/player/player-context";
import type { PlayerTrack } from "~/lib/types";

// Seeds the player queue (newest episodes first) without autoplay, only if nothing is queued
// yet — so navigating home never interrupts an in-progress episode. Renders nothing.
export function QueueSeeder({ tracks }: { tracks: PlayerTrack[] }) {
  const p = usePlayer();
  useEffect(() => {
    if (p.queue.length === 0 && tracks.length) p.setQueue(tracks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
