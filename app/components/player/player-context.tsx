// Persistent queue player — one <audio> element, one shared state, mounted once in root.tsx.
// React Router does client-side navigation after hydration, so this tree never unmounts and
// playback survives route changes. Everything the player UI and transcript need flows through
// usePlayer(). Resume position + Media Session (lock screen / car / media keys) included.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PlayerTrack } from "~/lib/types";

type PlayerState = {
  queue: PlayerTrack[];
  index: number;
  current: PlayerTrack | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  rate: number;
};

type PlayerApi = PlayerState & {
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
};

const PlayerContext = createContext<PlayerApi | null>(null);

const RESUME_PREFIX = "germomics-resume-";
const RATE_KEY = "germomics-rate";

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueueState] = useState<PlayerTrack[]>([]);
  const [index, setIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRateState] = useState(1);

  const current = index >= 0 && index < queue.length ? queue[index] : null;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const lastSaveRef = useRef(0);
  const pendingSeekRef = useRef<number | null>(null);

  // Restore last-used playback rate.
  useEffect(() => {
    const saved = Number(localStorage.getItem(RATE_KEY));
    if (saved >= 0.5 && saved <= 3) setRateState(saved);
  }, []);

  const saveResume = useCallback((id: number, time: number) => {
    try {
      localStorage.setItem(RESUME_PREFIX + id, String(Math.floor(time)));
    } catch {
      /* ignore */
    }
  }, []);

  // Load a new track when `current` changes; resume position on metadata; honor play intent.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.src !== current.audioUrl) {
      audio.src = current.audioUrl;
      audio.load();
    }
    audio.playbackRate = rate;
    const onMeta = () => {
      if (pendingSeekRef.current != null) {
        audio.currentTime = pendingSeekRef.current;
        pendingSeekRef.current = null;
      } else {
        const saved = Number(localStorage.getItem(RESUME_PREFIX + current.id));
        if (saved > 0 && saved < audio.duration - 5) audio.currentTime = saved;
      }
      if (isPlayingRef.current) void audio.play().catch(() => setIsPlaying(false));
    };
    audio.addEventListener("loadedmetadata", onMeta, { once: true });
    return () => audio.removeEventListener("loadedmetadata", onMeta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // Apply play/pause intent.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (isPlaying) void audio.play().catch(() => setIsPlaying(false));
    else audio.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  const next = useCallback(() => {
    setIndex((i) => (i + 1 < queue.length ? i + 1 : i));
    setIsPlaying(true);
  }, [queue.length]);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    setIndex((i) => (i > 0 ? i - 1 : i));
    setIsPlaying(true);
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || seconds));
    setCurrentTime(audio.currentTime);
  }, []);

  const skip = useCallback((delta: number) => {
    const audio = audioRef.current;
    if (audio) seek(audio.currentTime + delta);
  }, [seek]);

  const setRate = useCallback((r: number) => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = r;
    setRateState(r);
    try {
      localStorage.setItem(RATE_KEY, String(r));
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    if (!current) return;
    setIsPlaying((p) => !p);
  }, [current]);

  const pause = useCallback(() => setIsPlaying(false), []);

  const setQueue = useCallback((tracks: PlayerTrack[]) => {
    setQueueState(tracks);
  }, []);

  const playTrack = useCallback((track: PlayerTrack) => {
    setQueueState([track]);
    setIndex(0);
    setIsPlaying(true);
  }, []);

  const playQueueAt = useCallback((tracks: PlayerTrack[], i: number) => {
    setQueueState(tracks);
    setIndex(i);
    setIsPlaying(true);
  }, []);

  const playTrackAt = useCallback((track: PlayerTrack, seconds: number) => {
    pendingSeekRef.current = seconds;
    setQueueState([track]);
    setIndex(0);
    setIsPlaying(true);
  }, []);

  // Wire audio element events once.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setCurrentTime(audio.currentTime);
      if (current && audio.currentTime - lastSaveRef.current > 5) {
        lastSaveRef.current = audio.currentTime;
        saveResume(current.id, audio.currentTime);
      }
    };
    const onDur = () => setDuration(audio.duration || 0);
    const onEnd = () => {
      if (current) saveResume(current.id, 0);
      next();
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onDur);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onDur);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [current, next, saveResume]);

  // Media Session — lock screen, car, media keys (also satisfies a real player surface).
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    if (current) {
      ms.metadata = new MediaMetadata({
        title: current.title,
        artist: "germomics",
        album: "germomics",
        artwork: current.artwork ? [{ src: current.artwork, sizes: "512x512" }] : [],
      });
    }
    ms.setActionHandler("play", () => setIsPlaying(true));
    ms.setActionHandler("pause", () => setIsPlaying(false));
    ms.setActionHandler("previoustrack", prev);
    ms.setActionHandler("nexttrack", next);
    ms.setActionHandler("seekbackward", () => skip(-15));
    ms.setActionHandler("seekforward", () => skip(30));
    ms.setActionHandler("seekto", (d) => {
      if (typeof d.seekTime === "number") seek(d.seekTime);
    });
  }, [current, next, prev, seek, skip]);

  const value = useMemo<PlayerApi>(
    () => ({
      queue,
      index,
      current,
      isPlaying,
      currentTime,
      duration,
      rate,
      setQueue,
      playTrack,
      playQueueAt,
      playTrackAt,
      toggle,
      pause,
      next,
      prev,
      seek,
      skip,
      setRate,
    }),
    [queue, index, current, isPlaying, currentTime, duration, rate, setQueue, playTrack, playQueueAt, playTrackAt, toggle, pause, next, prev, seek, skip, setRate],
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      {/* The single audio element. Never unmounted. */}
      <audio ref={audioRef} preload="metadata" />
    </PlayerContext.Provider>
  );
}

export function usePlayer(): PlayerApi {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within <PlayerProvider>");
  return ctx;
}
