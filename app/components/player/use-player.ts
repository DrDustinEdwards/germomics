// The player's shared state and how components read it (usePlayer), apart from the provider in
// player-context.tsx, so that module exports only its component (Fast Refresh).
import { createContext, useContext } from "react";
import type { PlayerTrack } from "~/lib/types";

export type SleepMode = "end" | number; // "end" of episode, or minutes from now

type PlayerState = {
  queue: PlayerTrack[];
  index: number;
  current: PlayerTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  rate: number;
  volume: number;
  muted: boolean;
  buffering: boolean;
  errored: boolean;
  sleep: SleepMode | null;
  /** True only while the LOADED episode's own player surface is in the viewport (drives dock auto-hide). */
  surfaceVisible: boolean;
};

export type PlayerApi = PlayerState & {
  /** The shared <audio> element, for the transcript's native TextTrack highlight. */
  audioRef: React.RefObject<HTMLAudioElement | null>;
  /** Seed the queue without autoplay (home seeds all episodes, newest first). */
  setQueue: (tracks: PlayerTrack[]) => void;
  /** Play a single episode (episode detail page). */
  playTrack: (track: PlayerTrack) => void;
  /** Replace the queue and start at an index (home "play all"). */
  playQueueAt: (tracks: PlayerTrack[], index: number) => void;
  /** Play a single episode starting at a timestamp (transcript click, ?t deep link). */
  playTrackAt: (track: PlayerTrack, seconds: number) => void;
  toggle: () => void;
  pause: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  skip: (delta: number) => void;
  setRate: (rate: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  setSleep: (mode: SleepMode | null) => void;
  /** Reported by the episode surface: whether the loaded episode's surface is on screen. */
  setSurfaceVisible: (visible: boolean) => void;
  /** Explicit dismiss: pause and end the session so the dock unmounts and does not return on scroll. */
  dismiss: () => void;
};

export const PlayerContext = createContext<PlayerApi | null>(null);

export function usePlayer(): PlayerApi {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within <PlayerProvider>");
  return ctx;
}

/** Index of the chapter active at time t, or -1. Chapters are assumed sorted by start. */
export function activeChapterIndex(chapters: { start: number }[], t: number): number {
  let idx = -1;
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i].start <= t + 0.001) idx = i;
    else break;
  }
  return idx;
}
