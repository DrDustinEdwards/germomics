import { useMemo } from "react";
import { usePlayer } from "~/components/player/player-context";
import { formatDuration } from "~/lib/format";
import type { PlayerTrack } from "~/lib/types";

// The stored transcript is raw WebVTT (caption-style cues, often ~2s each). For a READING view
// we parse the cues and group consecutive ones into paragraphs (merging until a sentence ends),
// so it reads like a transcript rather than subtitles — while keeping each cue's start time so
// click-to-seek and current-line highlighting stay synced to playback, per cue.

type Cue = { start: number; end: number; text: string };

function toSeconds(h: string | undefined, m: string, s: string, ms: string): number {
  return (h ? parseInt(h, 10) * 3600 : 0) + parseInt(m, 10) * 60 + parseInt(s, 10) + Number(`0.${ms}`);
}

const TIMING =
  /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{3})\s*-->\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{3})/;

function parseVtt(vtt: string): Cue[] {
  const body = vtt.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const cues: Cue[] = [];
  for (const block of body.split(/\n{2,}/)) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    const tIdx = lines.findIndex((l) => l.includes("-->"));
    if (tIdx === -1) continue; // WEBVTT header / NOTE / STYLE blocks
    const m = lines[tIdx].match(TIMING);
    if (!m) continue;
    const start = toSeconds(m[1], m[2], m[3], m[4]);
    const end = toSeconds(m[5], m[6], m[7], m[8]);
    // Join wrapped caption lines; strip any inline VTT markup (<v>, <c>, <00:00:00.000>).
    const text = lines.slice(tIdx + 1).join(" ").replace(/<[^>]+>/g, "").trim();
    if (text) cues.push({ start, end, text });
  }
  return cues;
}

// Group cues into readable paragraphs: accumulate until a cue ends a sentence and the paragraph
// is long enough, or a noticeable speech gap appears. Keeps every cue intact (for per-cue sync).
function toParagraphs(cues: Cue[]): Cue[][] {
  const paras: Cue[][] = [];
  let cur: Cue[] = [];
  let words = 0;
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i];
    cur.push(c);
    words += c.text.split(/\s+/).length;
    const endsSentence = /[.!?]["'”’)\]]?$/.test(c.text);
    const gapAfter = cues[i + 1] ? cues[i + 1].start - c.end : 0;
    if ((endsSentence && words >= 45) || gapAfter > 2.5) {
      paras.push(cur);
      cur = [];
      words = 0;
    }
  }
  if (cur.length) paras.push(cur);
  return paras;
}

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
