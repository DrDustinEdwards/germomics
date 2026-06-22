import { useMemo } from "react";
import { usePlayer } from "~/components/player/player-context";
import { formatDuration } from "~/lib/format";
import { parseVtt, toParagraphs } from "~/lib/vtt";
import type { PlayerTrack } from "~/lib/types";

// The stored transcript is raw WebVTT (caption-style cues, often ~2s each). For a READING view
// we parse the cues and group consecutive ones into paragraphs (merging until a sentence ends),
// so it reads like a transcript rather than subtitles — while keeping each cue's start time so
// click-to-seek and current-line highlighting stay synced to playback, per cue. Parsing lives in
// ~/lib/vtt (shared with the editor's transcript field).

export function TranscriptPanel({ transcript, track }: { transcript: string; track: PlayerTrack }) {
  const p = usePlayer();
  const cues = useMemo(() => parseVtt(transcript), [transcript]);
  const paragraphs = useMemo(() => toParagraphs(cues), [cues]);
  const isThis = p.current?.id === track.id;

  // Active cue = last cue whose start is at/under the playhead (only for the loaded episode).
  const activeStart = useMemo(() => {
    if (!isThis) return null;
    let active: number | null = null;
    for (const c of cues) {
      if (c.start <= p.currentTime) active = c.start;
      else break;
    }
    return active;
  }, [cues, isThis, p.currentTime]);

  const jump = (seconds: number) => {
    if (isThis) p.seek(seconds);
    else p.playTrackAt(track, seconds);
  };

  // Fallback: if the value wasn't parseable as VTT, show it as plain text rather than nothing.
  if (!cues.length) {
    return <p className="whitespace-pre-wrap text-muted">{transcript}</p>;
  }

  return (
    <div className="space-y-4">
      {paragraphs.map((para, pi) => (
        <p key={pi} className="leading-relaxed">
          <button
            type="button"
            onClick={() => jump(para[0].start)}
            className="mr-2 align-baseline font-mono text-xs tabular-nums text-accent hover:underline"
            aria-label={`Play from ${formatDuration(para[0].start)}`}
          >
            {formatDuration(para[0].start)}
          </button>
          {para.map((c, ci) => {
            const active = c.start === activeStart;
            return (
              <button
                key={ci}
                type="button"
                onClick={() => jump(c.start)}
                aria-current={active ? "true" : undefined}
                title={formatDuration(c.start)}
                className={`cursor-pointer rounded px-0.5 text-left transition ${
                  active ? "bg-surface text-ink" : "hover:bg-surface/60"
                }`}
              >
                {c.text}{" "}
              </button>
            );
          })}
        </p>
      ))}
    </div>
  );
}
