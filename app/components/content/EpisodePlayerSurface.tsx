// The episode player surface: a slim transport over a waveform. The waveform is lazy-loaded (code
// split, client only) and is a pointer enhancement; the always-present native range slider is the
// accessible, keyboard-operable seek control so the waveform is never the only way to seek. All state
// flows through the one persistent <audio> via usePlayer(); this surface just targets THIS episode.
import { Suspense, lazy } from "react";
import { Play, Pause, RotateCcw, RotateCw, Gauge } from "lucide-react";
import type { PlayerTrack } from "~/lib/types";
import { usePlayer, activeChapterIndex } from "~/components/player/player-context";

const EpisodeWaveform = lazy(() => import("./EpisodeWaveform"));

const RATES = [1, 1.25, 1.5, 1.75, 2, 0.75];

function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function EpisodePlayerSurface({
  track,
  peaks,
}: {
  track: PlayerTrack;
  peaks: number[] | null;
}) {
  const p = usePlayer();
  const isActive = p.current?.id === track.id;
  const dur = (isActive && p.duration) || track.durationSec || 0;
  const pos = isActive ? p.currentTime : 0;
  const frac = dur > 0 ? Math.min(1, pos / dur) : 0;
  const playing = isActive && p.isPlaying;
  const chapters = track.chapters ?? [];
  const chapIdx = activeChapterIndex(chapters, pos);
  const chapter = chapIdx >= 0 ? chapters[chapIdx] : null;

  const seekTo = (seconds: number) => {
    if (isActive) p.seek(seconds);
    else p.playTrackAt(track, Math.max(0, seconds));
  };
  const onSeekFrac = (f: number) => seekTo(f * dur);
  const togglePlay = () => (isActive ? p.toggle() : p.playTrack(track));
  const skip = (d: number) => (isActive ? p.skip(d) : p.playTrackAt(track, Math.max(0, d)));
  const cycleRate = () => {
    const i = RATES.indexOf(p.rate);
    p.setRate(RATES[(i + 1) % RATES.length] ?? 1);
  };

  const region: [number, number] | null =
    chapter && dur > 0
      ? [chapter.start / dur, (chapters[chapIdx + 1]?.start ?? dur) / dur]
      : null;

  const ctrlBtn =
    "tap-target grid h-11 w-11 place-items-center rounded-full border border-border bg-card text-ink hover:border-brand";

  return (
    <section aria-label="Player" className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          className="tap-target grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-white hover:bg-brand-strong"
        >
          {playing ? <Pause size={22} aria-hidden /> : <Play size={22} aria-hidden className="translate-x-px" />}
        </button>
        <button type="button" onClick={() => skip(-15)} aria-label="Skip back 15 seconds" className={ctrlBtn}>
          <RotateCcw size={18} aria-hidden />
        </button>
        <button type="button" onClick={() => skip(15)} aria-label="Skip forward 15 seconds" className={ctrlBtn}>
          <RotateCw size={18} aria-hidden />
        </button>
        <button
          type="button"
          onClick={cycleRate}
          aria-label={`Playback speed ${p.rate} times`}
          className="tap-target inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-2 font-mono text-xs text-ink hover:border-brand"
        >
          <Gauge size={14} aria-hidden /> {p.rate}x
        </button>
        <div className="ml-auto text-right">
          {chapter ? (
            <p className="max-w-[14rem] truncate font-display text-sm text-ink" title={chapter.title}>
              {chapter.title}
            </p>
          ) : null}
          <p className="font-mono text-xs tabular-nums text-muted">
            {fmt(pos)} <span aria-hidden>/</span> {fmt(dur)}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <Suspense
          fallback={<div className="h-16 animate-none rounded-lg bg-card" aria-hidden />}
        >
          <EpisodeWaveform
            peaks={peaks}
            positionFrac={frac}
            durationSec={dur}
            activeRegion={region}
            onSeekFrac={onSeekFrac}
            synthetic={!peaks || peaks.length === 0}
          />
        </Suspense>
        {/* Accessible, keyboard-operable seek fallback. Always present so the waveform is not the only
            control. Visually slim but a real 44px-tall hit area via padding. */}
        <label className="sr-only" htmlFor="ep-seek">
          Seek within the episode
        </label>
        <input
          id="ep-seek"
          type="range"
          min={0}
          max={Math.max(1, Math.floor(dur))}
          step={1}
          value={Math.floor(pos)}
          onChange={(e) => seekTo(Number(e.currentTarget.value))}
          aria-valuetext={`${fmt(pos)} of ${fmt(dur)}`}
          className="mt-2 h-2 w-full cursor-pointer accent-[var(--color-brand)]"
        />
      </div>
    </section>
  );
}
