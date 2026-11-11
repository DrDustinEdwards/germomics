import { useEffect } from "react";
import { usePlayer } from "capsomer/react/player";
import type { PlayerTrack } from "~/lib/types";

// Seeds the player queue (newest episodes first) without autoplay, only if nothing is queued
// yet — so navigating home never interrupts an in-progress episode. Renders nothing.
export function QueueSeeder({ tracks }: { tracks: PlayerTrack[] }) {
  const p = usePlayer();
  useEffect(() => {
    if (p.queue.length === 0 && tracks.length) p.setQueue(tracks);
    // oxlint-disable-next-line react/exhaustive-deps -- seeds once, on mount, never on a later queue change
  }, []);
  return null;
}
