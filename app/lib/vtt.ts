// Client-safe WebVTT helpers, shared by the public TranscriptPanel and the editor's transcript
// field. Parsing cues, grouping them into readable paragraphs, splitting a cue's speaker label and
// converting SRT to VTT on import are Prelum's (./vtt); what stays here is the import field's loose
// "is this VTT" test.
export {
  type Cue,
  parseCueText,
  parseVtt,
  srtToVtt,
  toParagraphs,
} from "@drdustinedwards/site-helpers/vtt";

export function isProbablyVtt(text: string): boolean {
  return /^﻿?WEBVTT/.test(text.trimStart());
}
