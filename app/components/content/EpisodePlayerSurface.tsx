// The episode player surface: a compact transport over a waveform, built entirely from the shared
// player controls (app/components/player/controls.tsx) so it stays identical in capability, icons,
// labels, and keyboard behavior to the docked mini-player. Only primary controls show by default
// (play/pause, skip, scrubber + time); speed, volume, and sleep collapse into popovers. The waveform
// is a pointer-only visual enhancement (aria-hidden); the always-present range slider in <Scrubber>
// is the accessible, keyboard-operable seek control, so the waveform is never the only way to seek.
import { Suspense, lazy, useEffect, useLayoutEffect, useRef } from "react";
import type { PlayerTrack } from "~/lib/types";
import { usePlayer, activeChapterIndex } from "~/components/player/player-context";

// Layout effect on the client (so the dock's hidden state is set before paint, no flash on play),
// plain effect on the server (useLayoutEffect would warn during SSR).
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
import {
  PlayPauseButton,
  SkipButton,
  Scrubber,
  SpeedControl,
  VolumeControl,
  SleepTimerControl,
  TranscriptToggle,
} from "~/components/player/controls";

const EpisodeWaveform = lazy(() => import("./EpisodeWaveform"));

export function EpisodePlayerSurface({
  track,
  peaks,
}: {
  track: PlayerTrack;
  peaks: number[] | null;
}) {
  const p = usePlayer();
  const { setSurfaceVisible } = p;
  const isActive = p.current?.id === track.id;
  const sectionRef = useRef<HTMLElement | null>(null);

  // Drive the dock's auto-hide: report whether THIS surface is on screen, but only while this episode is
  // the one actually loaded in the player. If a different episode is playing, never hide the dock here.
  useIsoLayoutEffect(() => {
    if (!isActive) {
      setSurfaceVisible(false);
      return;
    }
    const el = sectionRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSurfaceVisible(r.top < window.innerHeight && r.bottom > 0);
    const io = new IntersectionObserver(
      (entries) => setSurfaceVisible(entries[0]?.isIntersecting ?? false),
      { threshold: 0 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      setSurfaceVisible(false);
    };
  }, [isActive, setSurfaceVisible]);

  const dur = (isActive && p.duration) || track.durationSec || 0;
  const pos = isActive ? p.currentTime : 0;
  const frac = dur > 0 ? Math.min(1, pos / dur) : 0;
  const chapters = track.chapters ?? [];
  const chapIdx = activeChapterIndex(chapters, pos);
  const chapter = isActive && chapIdx >= 0 ? chapters[chapIdx] : null;

  const onSeekFrac = (f: number) => {
    const s = f * dur;
    if (isActive) p.seek(s);
    else p.playTrackAt(track, Math.max(0, s));
  };
  const region: [number, number] | null =
    chapter && dur > 0
      ? [chapter.start / dur, (chapters[chapIdx + 1]?.start ?? dur) / dur]
      : null;

  return (
    <section ref={sectionRef} aria-label="Player" className="rounded-2xl border border-border bg-surface p-4">
      {chapter ? (
        <p className="mb-2 truncate font-display text-sm text-ink" title={chapter.title}>
          {chapter.title}
        </p>
      ) : null}

      {/* Waveform (visual, pointer-only) over the accessible range scrubber. */}
      <Suspense fallback={<div className="h-16 rounded-lg bg-card" aria-hidden />}>
        <EpisodeWaveform
          peaks={peaks}
          positionFrac={frac}
          durationSec={dur}
          activeRegion={region}
          onSeekFrac={onSeekFrac}
          synthetic={!peaks || peaks.length === 0}
        />
      </Suspense>
      <div className="mt-2">
        <Scrubber track={track} ticks />
      </div>

      {/* One control row: primary transport + collapsed secondary controls. */}
      <div className="mt-3 flex items-center gap-1.5">
        <PlayPauseButton track={track} size="lg" />
        <SkipButton delta={-15} track={track} />
        <SkipButton delta={30} track={track} />
        <div className="ml-auto flex items-center gap-1.5">
          <SpeedControl />
          <VolumeControl className="hidden md:block" />
          <SleepTimerControl />
          <TranscriptToggle slug={track.slug} samePage />
        </div>
      </div>
    </section>
  );
}
