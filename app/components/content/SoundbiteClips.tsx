// Public clip player for an episode's soundbites. Each clip plays the episode audio from its start
// and auto-pauses after its duration (scaled by playback rate). Uses the shared persistent player,
// so a clip just steers the one <audio> element. Renders nothing when there are no clips.
import { useEffect, useRef } from "react";
import { Icon, iconCut, iconPlay } from "capsomer/react/icons";
import type { PlayerTrack, SoundbiteView } from "~/lib/types";
import { timecode } from "capsomer/behavior/time";
import { usePlayer } from "capsomer/react/player";

export function SoundbiteClips({ track, clips }: { track: PlayerTrack; clips: SoundbiteView[] }) {
  const player = usePlayer();
  const stopAt = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (stopAt.current) clearTimeout(stopAt.current);
    },
    [],
  );

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
    <section className="gm-clips">
      <h2 className="gm-clips-title">
        <Icon d={iconCut} /> Soundbites
      </h2>
      <ul className="gm-clips-list">
        {clips.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => playClip(c.start, c.duration)} className="gm-clip">
              <span className="gm-clip-icon">
                <Icon d={iconPlay} />
              </span>
              <span className="gm-clip-text">
                <span className="gm-clip-title">{c.title || "Clip"}</span>
                <span className="gm-clip-meta">
                  {timecode(c.start * 1000)} · {c.duration}s
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
