// The docked player. Compact by default (play/pause, skip, scrubber + time, title + chapter label,
// and an obvious More toggle); expanding reveals every secondary control (speed, volume, sleep
// timer, chapter list, transcript link) so nothing is hidden without an entry point. The dock
// measures its own rendered height into --player-h with a ResizeObserver, and the body reserves that
// as padding-bottom, so the footer always clears the dock in every state (mobile/desktop x
// compact/expanded). Seeking never needs a drag (native range + key map, SC 2.5.7); the sleep timer
// uses a clock icon (the moon belongs to the theme toggle). Transport targets are >=44px.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  Play, Pause, SkipForward, RotateCcw, RotateCw, ChevronUp, ChevronDown,
  Gauge, Volume2, VolumeX, Timer, ListTree, Captions, AlertCircle, Loader2, Check,
} from "lucide-react";
import { usePlayer, activeChapterIndex, type SleepMode } from "./player-context";
import { formatDuration, spokenTime } from "~/lib/format";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const SLEEPS: { label: string; value: SleepMode }[] = [
  { label: "End of episode", value: "end" },
  { label: "5 min", value: 5 },
  { label: "10 min", value: 10 },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "60 min", value: 60 },
];

export function PlayerDock() {
  const p = usePlayer();
  const [expanded, setExpanded] = useState(false);
  const dockRef = useRef<HTMLDivElement | null>(null);

  // Measure the dock's real height into --player-h (0 when nothing is loaded). The body reserves it
  // as padding-bottom, so the footer always clears the fixed dock even when expanded or wrapped.
  useEffect(() => {
    const root = document.documentElement;
    if (!p.current) {
      root.style.setProperty("--player-h", "0px");
      return;
    }
    const el = dockRef.current;
    if (!el) return;
    const apply = () =>
      root.style.setProperty("--player-h", `${Math.ceil(el.getBoundingClientRect().height) + 8}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.setProperty("--player-h", "0px");
    };
  }, [p.current]);

  if (!p.current) return null;

  const chapters = p.current.chapters ?? [];
  const dur = p.duration || p.current.durationSec || 0;
  const curChapIdx = activeChapterIndex(chapters, p.currentTime);
  const curChap = curChapIdx >= 0 ? chapters[curChapIdx] : null;

  const status = p.errored
    ? "Error loading audio"
    : p.buffering
      ? "Buffering"
      : p.isPlaying
        ? `Playing${curChap ? `, ${curChap.title}` : ""}`
        : "Paused";

  function onSeekKey(e: React.KeyboardEvent<HTMLInputElement>) {
    const big = e.shiftKey ? 15 : 5;
    let handled = true;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") p.seek(p.currentTime - big);
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") p.seek(p.currentTime + big);
    else if (e.key === "PageDown") p.seek(p.currentTime - 60);
    else if (e.key === "PageUp") p.seek(p.currentTime + 60);
    else if (e.key === "Home") p.seek(0);
    else if (e.key === "End") p.seek(dur);
    else handled = false;
    if (handled) e.preventDefault();
  }

  const chip = (on: boolean) =>
    `rounded-full border px-2.5 py-1 font-mono text-xs ${
      on ? "border-accent text-accent" : "border-border text-muted hover:text-ink"
    }`;

  return (
    <div
      ref={dockRef}
      role="region"
      aria-label="Audio player"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div aria-live="polite" className="sr-only">{status}</div>

      {/* Expanded controls */}
      {expanded && (
        <div id="player-expanded" className="mx-auto max-h-[60vh] max-w-5xl space-y-4 overflow-y-auto border-b border-border px-4 py-4">
          {/* Speed */}
          <div>
            <label htmlFor="speed-range" className="flex items-center justify-between font-mono text-xs text-muted">
              <span className="flex items-center gap-1"><Gauge size={14} aria-hidden /> Speed</span>
              <span className="tabular-nums text-ink">{p.rate.toFixed(2)}x</span>
            </label>
            <input
              id="speed-range" type="range" min={0.5} max={3} step={0.05} value={p.rate}
              onChange={(e) => p.setRate(Number(e.target.value))}
              aria-valuetext={`${p.rate.toFixed(2)} times speed`}
              className="mt-2 h-1.5 w-full accent-[var(--color-accent)]"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SPEEDS.map((s) => (
                <button key={s} type="button" onClick={() => p.setRate(s)} aria-pressed={Math.abs(p.rate - s) < 0.001} className={chip(Math.abs(p.rate - s) < 0.001)}>
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Volume */}
          <div className="flex items-center gap-2">
            <button type="button" onClick={p.toggleMute} aria-label={p.muted ? "Unmute" : "Mute"} aria-pressed={p.muted} className="grid h-11 w-11 shrink-0 place-items-center rounded hover:text-accent">
              {p.muted || p.volume === 0 ? <VolumeX size={18} aria-hidden /> : <Volume2 size={18} aria-hidden />}
            </button>
            <label htmlFor="vol-range" className="sr-only">Volume</label>
            <input
              id="vol-range" type="range" min={0} max={1} step={0.05} value={p.muted ? 0 : p.volume}
              onChange={(e) => p.setVolume(Number(e.target.value))}
              aria-valuetext={`${Math.round((p.muted ? 0 : p.volume) * 100)} percent`}
              className="h-1.5 max-w-xs flex-1 accent-[var(--color-accent)]"
            />
          </div>

          {/* Sleep timer (clock icon, not a moon) */}
          <div>
            <p className="flex items-center gap-1 font-mono text-xs text-muted"><Timer size={14} aria-hidden /> Sleep timer</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => p.setSleep(null)} aria-pressed={p.sleep == null} className={chip(p.sleep == null)}>Off</button>
              {SLEEPS.map((opt) => {
                const on = p.sleep === opt.value;
                return (
                  <button key={String(opt.value)} type="button" onClick={() => p.setSleep(opt.value)} aria-pressed={on} className={`inline-flex items-center gap-1 ${chip(on)}`}>
                    {on ? <Check size={12} aria-hidden /> : null}{opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Chapters */}
          {chapters.length > 0 && (
            <div>
              <p className="flex items-center gap-1 font-mono text-xs text-muted"><ListTree size={14} aria-hidden /> Chapters</p>
              <ul className="mt-2 max-h-48 overflow-y-auto">
                {chapters.map((c, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => p.seek(c.start)} aria-current={i === curChapIdx ? "true" : undefined} className={`flex min-h-11 w-full items-center gap-3 rounded px-2 text-left hover:bg-card ${i === curChapIdx ? "text-accent" : ""}`}>
                      <span className="font-mono text-xs tabular-nums text-accent">{formatDuration(c.start)}</span>
                      <span className="truncate">{c.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Transcript entry point */}
          <Link to={`/${p.current.slug}#transcript`} className="inline-flex items-center gap-1.5 font-mono text-xs text-accent hover:underline">
            <Captions size={14} aria-hidden /> View transcript
          </Link>
        </div>
      )}

      <div className="mx-auto max-w-5xl px-4">
        {/* Scrubber row (full width) with chapter ticks */}
        <div className="flex items-center gap-2 pt-2">
          <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted">{formatDuration(p.currentTime)}</span>
          <div className="relative flex-1">
            <input
              type="range" min={0} max={dur || 1} value={Math.min(p.currentTime, dur || 1)} step={1} disabled={!dur}
              onChange={(e) => p.seek(Number(e.target.value))}
              onKeyDown={onSeekKey}
              aria-label="Seek"
              aria-valuetext={`${spokenTime(p.currentTime)} of ${spokenTime(dur)}`}
              className="h-1.5 w-full accent-[var(--color-accent)]"
            />
            {dur > 0 && chapters.map((c, i) => (
              <span key={i} aria-hidden title={c.title} className="pointer-events-none absolute top-1/2 h-2 w-px -translate-y-1/2 bg-ink/40" style={{ left: `${Math.min(100, (c.start / dur) * 100)}%` }} />
            ))}
          </div>
          <span className="w-12 shrink-0 font-mono text-[11px] tabular-nums text-muted">{formatDuration(dur)}</span>
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-2 py-1.5">
          <div className="min-w-0 flex-1">
            <Link to={`/${p.current.slug}`} title={p.current.title} className="block truncate font-display text-sm font-medium text-ink hover:text-accent">
              {p.current.title}
            </Link>
            <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-accent">
              {p.errored ? (
                <span className="flex items-center gap-1 text-brand"><AlertCircle size={12} aria-hidden /> Error</span>
              ) : p.buffering ? (
                <span className="flex items-center gap-1"><Loader2 size={12} aria-hidden className="motion-safe:animate-spin" /> Buffering</span>
              ) : (
                <span className="truncate">{curChap ? curChap.title : "now playing"}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            <button type="button" onClick={() => p.skip(-15)} aria-label="Rewind 15 seconds" className="grid h-11 w-11 place-items-center rounded hover:text-accent">
              <RotateCcw size={18} aria-hidden />
            </button>
            <button type="button" onClick={p.toggle} aria-label={p.isPlaying ? "Pause" : "Play"} aria-pressed={p.isPlaying} className="grid h-11 w-11 place-items-center rounded-full bg-accent text-bg hover:brightness-110">
              {p.isPlaying ? <Pause size={20} aria-hidden /> : <Play size={20} aria-hidden />}
            </button>
            <button type="button" onClick={() => p.skip(30)} aria-label="Skip forward 30 seconds" className="grid h-11 w-11 place-items-center rounded hover:text-accent">
              <RotateCw size={18} aria-hidden />
            </button>
            <button type="button" onClick={p.next} disabled={p.index >= p.queue.length - 1} aria-label="Next episode" className="grid h-11 w-11 place-items-center rounded hover:text-accent disabled:opacity-40">
              <SkipForward size={18} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setExpanded((x) => !x)}
              aria-label={expanded ? "Hide player controls" : "More player controls"}
              aria-expanded={expanded}
              aria-controls="player-expanded"
              className={`grid h-11 w-11 place-items-center rounded hover:text-accent ${expanded || p.sleep != null ? "text-accent" : ""}`}
            >
              {expanded ? <ChevronDown size={20} aria-hidden /> : <ChevronUp size={20} aria-hidden />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
