// Persistent queue player — one <audio> element, one shared state, mounted once in root.tsx.
// React Router does client-side navigation after hydration, so this tree never unmounts and
// playback survives route changes. Everything the player UI and transcript need flows through
// usePlayer(). Includes resume position, volume/mute, sleep timer, buffering/error state, and a
// complete Media Session surface (lock screen / car / media keys): metadata + chapterInfo +
// position state + all transport/seek handlers.
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

type PlayerApi = PlayerState & {
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

const PlayerContext = createContext<PlayerApi | null>(null);

const RESUME_PREFIX = "germomics-resume-";
const RATE_KEY = "germomics-rate";
const VOL_KEY = "germomics-volume";

function ms(): MediaSession | null {
  if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return null;
  return navigator.mediaSession;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [queue, setQueueState] = useState<PlayerTrack[]>([]);
  const [index, setIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRateState] = useState(1);
  const [volume, setVolumeState] = useState(1);
  const [muted, setMuted] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [errored, setErrored] = useState(false);
  const [sleep, setSleepState] = useState<SleepMode | null>(null);
  const [surfaceVisible, setSurfaceVisibleState] = useState(false);

  const current = index >= 0 && index < queue.length ? queue[index] : null;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const lastSaveRef = useRef(0);
  const pendingSeekRef = useRef<number | null>(null);
  const sleepRef = useRef<SleepMode | null>(null);
  sleepRef.current = sleep;

  // Restore last-used rate + volume.
  useEffect(() => {
    const r = Number(localStorage.getItem(RATE_KEY));
    if (r >= 0.5 && r <= 3) setRateState(r);
    const v = localStorage.getItem(VOL_KEY);
    if (v !== null && Number(v) >= 0 && Number(v) <= 1) setVolumeState(Number(v));
  }, []);

  const saveResume = useCallback((id: number, time: number) => {
    try {
      localStorage.setItem(RESUME_PREFIX + id, String(Math.floor(time)));
    } catch {
      /* ignore */
    }
  }, []);

  // Push position to the lock screen. Guards NaN/Infinity; safe no-op without Media Session.
  const updatePositionState = useCallback(() => {
    const audio = audioRef.current;
    const session = ms();
    if (!audio || !session || typeof session.setPositionState !== "function") return;
    const dur = audio.duration;
    const pos = audio.currentTime;
    const r = audio.playbackRate;
    if (!Number.isFinite(dur) || dur <= 0 || !Number.isFinite(pos)) return;
    try {
      session.setPositionState({
        duration: dur,
        playbackRate: Number.isFinite(r) && r > 0 ? r : 1,
        position: Math.min(Math.max(pos, 0), dur),
      });
    } catch {
      /* some browsers throw on odd values */
    }
  }, []);

  // Apply volume/mute to the element.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted]);

  // Load a new track when `current` changes; resume position on metadata; honor play intent.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    setErrored(false);
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
      updatePositionState();
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

  const seek = useCallback(
    (seconds: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = Math.max(0, Math.min(seconds, audio.duration || seconds));
      setCurrentTime(audio.currentTime);
      updatePositionState();
    },
    [updatePositionState],
  );

  const skip = useCallback(
    (delta: number) => {
      const audio = audioRef.current;
      if (audio) seek(audio.currentTime + delta);
    },
    [seek],
  );

  const setRate = useCallback(
    (r: number) => {
      const clamped = Math.min(3, Math.max(0.5, r));
      const audio = audioRef.current;
      if (audio) audio.playbackRate = clamped;
      setRateState(clamped);
      try {
        localStorage.setItem(RATE_KEY, String(clamped));
      } catch {
        /* ignore */
      }
      updatePositionState();
    },
    [updatePositionState],
  );

  const setVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    setVolumeState(clamped);
    if (clamped > 0) setMuted(false);
    try {
      localStorage.setItem(VOL_KEY, String(clamped));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

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

  const setSleep = useCallback((mode: SleepMode | null) => setSleepState(mode), []);

  const setSurfaceVisible = useCallback((visible: boolean) => setSurfaceVisibleState(visible), []);

  // Explicit dismiss (the dock's close control): stop audio and clear the now-playing state so the dock
  // unmounts. Distinct from auto-hide (which only toggles surfaceVisible). Resume positions are kept, so
  // pressing play on any surface revives the dock and continues where the listener left off.
  const dismiss = useCallback(() => {
    const audio = audioRef.current;
    if (audio) audio.pause();
    setIsPlaying(false);
    setIndex(-1);
    setQueueState([]);
    setSleepState(null);
    setSurfaceVisibleState(false);
  }, []);

  // Sleep timer: a minute count pauses after N minutes; "end" is handled on `ended`.
  useEffect(() => {
    if (typeof sleep !== "number") return;
    const id = setTimeout(() => {
      setIsPlaying(false);
      setSleepState(null);
    }, sleep * 60 * 1000);
    return () => clearTimeout(id);
  }, [sleep]);

  // Wire audio element events once.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setCurrentTime(audio.currentTime);
      updatePositionState();
      if (current && audio.currentTime - lastSaveRef.current > 5) {
        lastSaveRef.current = audio.currentTime;
        saveResume(current.id, audio.currentTime);
      }
    };
    const onDur = () => setDuration(audio.duration || 0);
    const onEnd = () => {
      if (current) saveResume(current.id, 0);
      if (sleepRef.current === "end") {
        setIsPlaying(false);
        setSleepState(null);
        return;
      }
      next();
    };
    const onPlay = () => {
      setIsPlaying(true);
      setBuffering(false);
      updatePositionState();
    };
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => {
      setBuffering(false);
      setErrored(false);
    };
    const onStalled = () => setBuffering(true);
    const onError = () => {
      setErrored(true);
      setBuffering(false);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("durationchange", onDur);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("stalled", onStalled);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("durationchange", onDur);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("stalled", onStalled);
      audio.removeEventListener("error", onError);
    };
  }, [current, next, saveResume, updatePositionState]);

  // Media Session: metadata (+ chapterInfo + artwork fallback) and every action handler.
  useEffect(() => {
    const session = ms();
    if (!session) return;
    // Reset position on track change; it repopulates once the new duration is known.
    try {
      (session.setPositionState as (s?: MediaPositionState) => void)(undefined);
    } catch {
      /* ignore */
    }
    if (current) {
      const origin = typeof location !== "undefined" ? location.origin : "";
      const artwork = current.artwork
        ? [{ src: current.artwork, sizes: "1400x1400", type: "image/jpeg" }]
        : [
            { src: `${origin}/icon-512.png`, sizes: "512x512", type: "image/png" },
            { src: `${origin}/icon-192.png`, sizes: "192x192", type: "image/png" },
          ];
      const chapters = current.chapters ?? [];
      const init: MediaMetadataInit & { chapterInfo?: unknown } = {
        title: current.title,
        artist: "Germomics",
        album: current.episodeNumber ? `Episode ${current.episodeNumber}` : "Germomics",
        artwork,
      };
      if (chapters.length) {
        init.chapterInfo = chapters.map((c) => ({ title: c.title, startTime: c.start }));
      }
      session.metadata = new MediaMetadata(init as MediaMetadataInit);
    }
    session.setActionHandler("play", () => setIsPlaying(true));
    session.setActionHandler("pause", () => setIsPlaying(false));
    session.setActionHandler("stop", () => setIsPlaying(false));
    session.setActionHandler("previoustrack", prev);
    session.setActionHandler("nexttrack", next);
    session.setActionHandler("seekbackward", (d) => skip(-(d.seekOffset ?? 15)));
    session.setActionHandler("seekforward", (d) => skip(d.seekOffset ?? 30));
    session.setActionHandler("seekto", (d) => {
      if (typeof d.seekTime !== "number") return;
      const audio = audioRef.current;
      if (audio && typeof audio.fastSeek === "function" && d.fastSeek) audio.fastSeek(d.seekTime);
      else seek(d.seekTime);
      updatePositionState();
    });
    return () => {
      // Clear handlers so a stale closure never fires after unmount.
      for (const a of ["play", "pause", "stop", "previoustrack", "nexttrack", "seekbackward", "seekforward", "seekto"] as const) {
        try {
          session.setActionHandler(a, null);
        } catch {
          /* ignore */
        }
      }
    };
  }, [current, next, prev, seek, skip, updatePositionState]);

  // Reflect play state on the lock screen.
  useEffect(() => {
    const session = ms();
    if (session) session.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  const value = useMemo<PlayerApi>(
    () => ({
      queue, index, current, isPlaying, currentTime, duration, rate, volume, muted, buffering, errored, sleep, surfaceVisible,
      audioRef,
      setQueue, playTrack, playQueueAt, playTrackAt, toggle, pause, next, prev, seek, skip, setRate,
      setVolume, toggleMute, setSleep, setSurfaceVisible, dismiss,
    }),
    [queue, index, current, isPlaying, currentTime, duration, rate, volume, muted, buffering, errored, sleep, surfaceVisible, setQueue, playTrack, playQueueAt, playTrackAt, toggle, pause, next, prev, seek, skip, setRate, setVolume, toggleMute, setSleep, setSurfaceVisible, dismiss],
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      {/* The single audio element. Never unmounted. preload metadata only; no autoplay. */}
      <audio ref={audioRef} preload="metadata" />
    </PlayerContext.Provider>
  );
}

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
