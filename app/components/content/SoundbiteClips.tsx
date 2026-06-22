// Public clip player for an episode's soundbites. Each clip plays the episode audio from its start
// and auto-pauses after its duration (scaled by playback rate). Uses the shared persistent player,
// so a clip just steers the one <audio> element. Renders nothing when there are no clips.
import { useEffect, useRef } from "react";
import { Scissors, Play } from "lucide-react";
import type { PlayerTrack, SoundbiteView } from "~/lib/types";
import { formatDuration } from "~/lib/format";
import { usePlayer } from "~/components/player/player-context";

export function SoundbiteClips({ track, clips }: { track: PlayerTrack; clips: SoundbiteView[] }) {
  const player = usePlayer();
  const stopAt = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (stopAt.current) clearTimeout(stopAt.current);
  }, []);

  if (!clips.length) return null;

  function playClip(start: number, duration: number) {
    if (stopAt.current) clearTimeout(stopAt.current);
    if (player.current?.id === track.id) player.seek(start);
    else player.playTrackAt(track, start);
    // Auto-pause at the end of the clip (duration is wall-clock seconds adjusted for rate).
    const ms = (duration / (player.rate || 1)) * 1000;
    stopAt.current = setTimeout(() => player.pause(), ms);
  }

  return (
    <section className="mt-10">
      <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-semibold">
        <Scissors size={18} aria-hidden /> Soundbites
      </h2>
      <ul className="grid gap-2">
        {clips.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => playClip(c.start, c.duration)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left hover:border-accent"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-bg">
                <Play size={16} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-sm text-ink">{c.title || "Clip"}</span>
                <span className="font-mono text-[11px] text-muted">
                  {formatDuration(c.start)} · {c.duration}s
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
