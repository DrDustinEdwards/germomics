// Client-safe WebVTT helpers, shared by the public TranscriptPanel and the editor's transcript
// field. Parse cues, group them into readable paragraphs, and convert SRT → VTT on import.
export type Cue = { start: number; end: number; text: string };

const TIMING =
  /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{3})\s*-->\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})[.,](\d{3})/;

function toSeconds(h: string | undefined, m: string, s: string, ms: string): number {
  return (h ? parseInt(h, 10) * 3600 : 0) + parseInt(m, 10) * 60 + parseInt(s, 10) + Number(`0.${ms}`);
}

export function parseVtt(vtt: string): Cue[] {
  const body = (vtt ?? "").replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const cues: Cue[] = [];
  for (const block of body.split(/\n{2,}/)) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    const tIdx = lines.findIndex((l) => l.includes("-->"));
    if (tIdx === -1) continue; // WEBVTT header / NOTE / STYLE
    const m = lines[tIdx].match(TIMING);
    if (!m) continue;
    const start = toSeconds(m[1], m[2], m[3], m[4]);
    const end = toSeconds(m[5], m[6], m[7], m[8]);
    const text = lines.slice(tIdx + 1).join(" ").replace(/<[^>]+>/g, "").trim();
    if (text) cues.push({ start, end, text });
  }
  return cues;
}

/** Group caption-style cues into readable paragraphs while keeping per-cue timing. */
export function toParagraphs(cues: Cue[]): Cue[][] {
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

/** Convert SRT to WebVTT (comma → dot timestamps, add header, drop numeric counters). */
export function srtToVtt(srt: string): string {
  const body = srt
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/^\d+\s*$/gm, "") // numeric cue indices
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2"); // comma → dot
  return `WEBVTT\n\n${body.trim()}\n`;
}

export function isProbablyVtt(text: string): boolean {
  return /^﻿?WEBVTT/.test(text.trimStart());
}
