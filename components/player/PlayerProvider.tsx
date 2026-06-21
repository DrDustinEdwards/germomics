'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Track } from '@/lib/player';

const RESUME_KEY = 'germomics-resume'; // { [trackId]: seconds }

type PlayerState = {
  queue: Track[];
  index: number;
  current: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  rate: number;
};

type PlayerApi = PlayerState & {
  /** Replace the queue and start at startIndex. */
  playQueue: (tracks: Track[], startIndex?: number) => void;
  /** Play a single track (queue of one), or resume/pause if it is already current. */
  playTrack: (track: Track) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (seconds: number) => void;
  skip: (delta: number) => void;
  setRate: (rate: number) => void;
};

const Ctx = createContext<PlayerApi | null>(null);

export function usePlayer(): PlayerApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('usePlayer must be used within <PlayerProvider>');
  return ctx;
}

function readResume(id: number): number {
  try {
    const map = JSON.parse(localStorage.getItem(RESUME_KEY) || '{}');
    return typeof map[id] === 'number' ? map[id] : 0;
  } catch {
    return 0;
  }
}

function writeResume(id: number, seconds: number): void {
  try {
    const map = JSON.parse(localStorage.getItem(RESUME_KEY) || '{}');
    map[id] = seconds;
    localStorage.setItem(RESUME_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export default function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRateState] = useState(1);

  const current = queue[index] ?? null;

  const load = useCallback((track: Track, autoplay: boolean) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = track.audioUrl;
    audio.playbackRate = rate;
    const resume = readResume(track.id);
    const start = () => {
      if (resume > 0 && resume < (audio.duration || Infinity) - 5) audio.currentTime = resume;
      audio.removeEventListener('loadedmetadata', start);
      if (autoplay) void audio.play();
    };
    audio.addEventListener('loadedmetadata', start);
    audio.load();
  }, [rate]);

  const playQueue = useCallback((tracks: Track[], startIndex = 0) => {
    if (!tracks.length) return;
    setQueue(tracks);
    setIndex(startIndex);
    load(tracks[startIndex], true);
  }, [load]);

  const playTrack = useCallback((track: Track) => {
    if (current?.id === track.id) {
      const audio = audioRef.current;
      if (audio) (audio.paused ? void audio.play() : audio.pause());
      return;
    }
    playQueue([track], 0);
  }, [current, playQueue]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  }, [current]);

  const goTo = useCallback((i: number) => {
    if (i < 0 || i >= queue.length) return;
    setIndex(i);
    load(queue[i], true);
  }, [queue, load]);

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const prev = useCallback(() => goTo(index - 1), [goTo, index]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = Math.max(0, seconds);
  }, []);

  const skip = useCallback((delta: number) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + delta));
  }, []);

  const setRate = useCallback((r: number) => {
    setRateState(r);
    if (audioRef.current) audioRef.current.playbackRate = r;
  }, []);

  // Audio element event wiring.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTime = () => {
      setCurrentTime(audio.currentTime);
      if (current) writeResume(current.id, audio.currentTime);
    };
    const onMeta = () => setDuration(audio.duration || 0);
    const onEnded = () => goTo(index + 1);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnded);
    };
  }, [current, goTo, index]);

  // Media Session API (lock screen / car / media keys).
  useEffect(() => {
    if (!current || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: 'germomics',
      artwork: current.artwork ? [{ src: current.artwork, sizes: '512x512' }] : undefined,
    });
    navigator.mediaSession.setActionHandler('play', () => toggle());
    navigator.mediaSession.setActionHandler('pause', () => toggle());
    navigator.mediaSession.setActionHandler('previoustrack', () => prev());
    navigator.mediaSession.setActionHandler('nexttrack', () => next());
    navigator.mediaSession.setActionHandler('seekbackward', () => skip(-15));
    navigator.mediaSession.setActionHandler('seekforward', () => skip(30));
  }, [current, toggle, prev, next, skip]);

  const api = useMemo<PlayerApi>(() => ({
    queue, index, current, isPlaying, currentTime, duration, rate,
    playQueue, playTrack, toggle, next, prev, seek, skip, setRate,
  }), [queue, index, current, isPlaying, currentTime, duration, rate,
    playQueue, playTrack, toggle, next, prev, seek, skip, setRate]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {/* Single audio element for the whole app, never unmounted on navigation. */}
      <audio ref={audioRef} preload="metadata" />
    </Ctx.Provider>
  );
}
