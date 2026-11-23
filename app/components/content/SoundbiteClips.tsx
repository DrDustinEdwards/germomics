// Public clip player for an episode's soundbites. Each clip plays the episode audio from its start
// and pauses at its end. Uses the shared persistent player,
// so a clip just steers the one <audio> element. Renders nothing when there are no clips.
import { useEffect, useRef } from "react";
import { Icon, iconCut, iconPlay } from "capsomer/react/icons";
import type { PlayerTrack, SoundbiteView } from "~/lib/types";
import { timecode } from "capsomer/behavior/time";
import { usePlayer } from "capsomer/react/player";

export function SoundbiteClips({ track, clips }: { track: PlayerTrack; clips: SoundbiteView[] }) {
  const player = usePlayer();
  // The clip now playing. It ends at its end time on the player's own clock, so a reader who seeks, changes the rate or
  // moves to another track is never paused by a stale timer: the clip is dropped the moment playback leaves it.
  const clip = useRef<{ start: number; end: number; entered: boolean } | null>(null);
  const { current, currentTime } = player;

  useEffect(() => {
    const c = clip.current;
    if (!c) return;
    if (current?.id !== track.id) clip.current = null;
    else if (currentTime >= c.end) {
      clip.current = null;
      player.pause();
    } else if (currentTime >= c.start - 0.5) c.entered = true;
    else if (c.entered) clip.current = null;
  }, [current?.id, currentTime, player, track.id]);

  if (!clips.length) return null;

  function playClip(start: number, duration: number) {
    clip.current = { start, end: start + duration, entered: false };
    if (current?.id === track.id) player.seek(start);
    else player.playTrackAt(track, start);
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
