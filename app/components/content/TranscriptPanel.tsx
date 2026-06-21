import { useMemo } from "react";
import { usePlayer } from "~/components/player/player-context";
import { formatDuration, stampToSeconds } from "~/lib/format";
import type { PlayerTrack } from "~/lib/types";

type Cue = { time: number | null; text: string };

// Parse lines like "[01:23] Some spoken text" into clickable cues. Lines without a leading
// timestamp render as plain paragraphs, so any transcript still displays.
function parse(transcript: string): Cue[] {
  return transcript
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.*)$/);
      return m ? { time: stampToSeconds(m[1]), text: m[2] } : { time: null, text: line };
    });
}

export function TranscriptPanel({ transcript, track }: { transcript: string; track: PlayerTrack }) {
  const p = usePlayer();
  const cues = useMemo(() => parse(transcript), [transcript]);
  const isThis = p.current?.id === track.id;

  // Active cue = last timestamped cue at/under the playhead (only for the loaded episode).
  const activeIdx = useMemo(() => {
    if (!isThis) return -1;
    let idx = -1;
    for (let i = 0; i < cues.length; i++) {
      const t = cues[i].time;
      if (t != null && t <= p.currentTime) idx = i;
    }
    return idx;
  }, [cues, isThis, p.currentTime]);

  const jump = (seconds: number) => {
    if (isThis) p.seek(seconds);
    else p.playTrackAt(track, seconds);
  };

  return (
    <div className="space-y-1">
      {cues.map((c, i) =>
        c.time == null ? (
          <p key={i} className="py-1 text-muted">
            {c.text}
          </p>
        ) : (
          <button
            key={i}
            type="button"
            onClick={() => jump(c.time!)}
            aria-current={i === activeIdx ? "true" : undefined}
            className={`flex w-full items-start gap-3 rounded px-2 py-1.5 text-left transition ${
              i === activeIdx ? "bg-surface text-ink" : "hover:bg-surface/60"
            }`}
          >
            <span className="mt-0.5 font-mono text-xs tabular-nums text-accent">
              {formatDuration(c.time)}
            </span>
            <span>{c.text}</span>
          </button>
        ),
      )}
    </div>
  );
}
