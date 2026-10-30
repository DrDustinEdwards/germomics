// Shared player controls — the single source of truth for BOTH the episode-page player surface and
// the persistent PlayerDock. Every control is driven by the one player context (player-context.tsx),
// so the two surfaces offer the same capability, icons, labels, and keyboard behavior; they differ
// only in size and placement. Nothing here implements a one-off control.
//
// Transport + scrubber accept an optional `track`: on the episode page they target THAT episode
// (switching the global player to it on first interaction) without hijacking a different now-playing
// track; the dock passes no track and drives whatever is current. Speed, volume, and sleep are global
// player settings, so those controls need no track.
//
// Progressive disclosure: only play/pause, skip, and the scrubber are visible by default. Speed,
// sleep timer, and volume collapse into compact icon buttons that open an accessible popover (focus
// moves in, Esc and outside-click close, focus returns to the trigger). Transitions are motion-safe
// only (suppressed under prefers-reduced-motion).
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "capsomer/react/link";
import {
  Play, Pause, RotateCcw, RotateCw, SkipForward, Gauge, Volume2, VolumeX,
  Timer, ListTree, Captions, Check,
} from "lucide-react";
import { usePlayer, activeChapterIndex, type SleepMode } from "./player-context";
import { formatDuration, spokenTime } from "~/lib/format";
import type { PlayerTrack } from "~/lib/types";

// ── Shared option sets ───────────────────────────────────────────────────────
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const SLEEP_OPTIONS: { value: SleepMode | null; label: string }[] = [
  { value: null, label: "Off" },
  { value: "end", label: "End of episode" },
  { value: 5, label: "5 minutes" },
  { value: 10, label: "10 minutes" },
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 45, label: "45 minutes" },
  { value: 60, label: "60 minutes" },
];

function formatRate(r: number): string {
  return (Number.isInteger(r) ? r.toFixed(1) : String(r)) + "x";
}
function sleepSummary(s: SleepMode | null): string {
  if (s == null) return "off";
  if (s === "end") return "end of episode";
  return `${s} minutes`;
}

// ── Accessible popover primitive ─────────────────────────────────────────────
// A labeled disclosure: an icon/text trigger that toggles a floating panel. On open, focus moves to
// the panel's marked element; Esc and outside pointer/focus close it and return focus to the trigger.
function Popover({
  label,
  panelLabel,
  buttonContent,
  active,
  openUp,
  align = "end",
  children,
}: {
  label: string;
  panelLabel?: string;
  buttonContent: React.ReactNode;
  active?: boolean;
  openUp?: boolean;
  align?: "start" | "end";
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const panelId = useId();
  const close = useCallback(() => {
    setOpen(false);
    btnRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    // Focus the marked element (selected option) or the first focusable in the panel.
    const panel = panelRef.current;
    const target =
      panel?.querySelector<HTMLElement>("[data-autofocus]") ??
      panel?.querySelector<HTMLElement>('button,[href],input,[tabindex]:not([tabindex="-1"])');
    target?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, close]);

  // Close when focus leaves the control entirely (e.g. Tab out).
  const onBlur = (e: React.FocusEvent) => {
    if (!rootRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative" onBlur={onBlur}>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className={`tap-target inline-grid h-11 min-w-11 place-items-center rounded-full border px-2 font-mono text-xs ${
          active ? "border-accent text-accent" : "border-border bg-card text-ink hover:border-brand"
        }`}
      >
        {buttonContent}
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="group"
          aria-label={panelLabel ?? label}
          className={`absolute z-40 min-w-[12rem] rounded-xl border border-border bg-card p-2 shadow-lg motion-safe:transition motion-safe:duration-100 ${
            openUp ? "bottom-full mb-2" : "top-full mt-2"
          } ${align === "end" ? "right-0" : "left-0"}`}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

// A radio menu (arrow-key navigable, roving tabindex) for the speed/sleep option lists. Shared by the
// desktop popovers and the mobile sheet.
function RadioMenu<V>({
  options,
  value,
  equals,
  onSelect,
  ariaLabel,
}: {
  options: { value: V; label: string }[];
  value: V;
  equals: (a: V, b: V) => boolean;
  onSelect: (v: V) => void;
  ariaLabel: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIdx = options.findIndex((o) => equals(o.value, value));
  const focusIdx = selectedIdx === -1 ? 0 : selectedIdx;
  const move = (from: number, dir: number) => {
    const n = options.length;
    refs.current[(from + dir + n) % n]?.focus();
  };
  return (
    <ul role="menu" aria-label={ariaLabel} className="grid gap-0.5">
      {options.map((o, i) => {
        const sel = equals(o.value, value);
        return (
          <li key={i} role="none">
            <button
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="menuitemradio"
              aria-checked={sel}
              tabIndex={i === focusIdx ? 0 : -1}
              data-autofocus={i === focusIdx ? "" : undefined}
              onClick={() => onSelect(o.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") (e.preventDefault(), move(i, 1));
                else if (e.key === "ArrowUp") (e.preventDefault(), move(i, -1));
                else if (e.key === "Home") (e.preventDefault(), refs.current[0]?.focus());
                else if (e.key === "End") (e.preventDefault(), refs.current[options.length - 1]?.focus());
              }}
              className={`flex min-h-11 w-full items-center justify-between gap-4 rounded-lg px-3 text-left text-sm hover:bg-surface ${
                sel ? "text-accent" : "text-ink"
              }`}
            >
              <span>{o.label}</span>
              {sel ? <Check size={15} aria-hidden /> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// ── Transport ────────────────────────────────────────────────────────────────
// Play/pause uses a dynamic label (Play/Pause) and no aria-pressed (APG: do one, not both).
export function PlayPauseButton({ track, size = "md" }: { track?: PlayerTrack; size?: "md" | "lg" }) {
  const p = usePlayer();
  const isThis = !track || p.current?.id === track.id;
  const playing = isThis && p.isPlaying;
  const dim = size === "lg" ? "h-12 w-12" : "h-11 w-11";
  const ic = size === "lg" ? 22 : 20;
  const onClick = () => {
    if (isThis) p.toggle();
    else if (track) p.playTrack(track);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={playing ? "Pause" : "Play"}
      className={`tap-target grid ${dim} shrink-0 place-items-center rounded-full bg-brand text-white hover:bg-brand-strong`}
    >
      {playing ? <Pause size={ic} aria-hidden /> : <Play size={ic} aria-hidden className="translate-x-px" />}
    </button>
  );
}

export function SkipButton({ delta, track }: { delta: number; track?: PlayerTrack }) {
  const p = usePlayer();
  const isThis = !track || p.current?.id === track.id;
  const back = delta < 0;
  const secs = Math.abs(delta);
  const onClick = () => {
    if (isThis) p.skip(delta);
    else if (track) p.playTrackAt(track, Math.max(0, delta));
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={back ? `Rewind ${secs} seconds` : `Skip forward ${secs} seconds`}
      className="tap-target grid h-11 w-11 place-items-center rounded-full border border-border bg-card text-ink hover:border-brand"
    >
      {back ? <RotateCcw size={18} aria-hidden /> : <RotateCw size={18} aria-hidden />}
    </button>
  );
}

export function NextButton() {
  const p = usePlayer();
  return (
    <button
      type="button"
      onClick={p.next}
      disabled={p.index >= p.queue.length - 1}
      aria-label="Next episode"
      className="tap-target grid h-11 w-11 place-items-center rounded-full text-ink hover:text-accent disabled:opacity-40 disabled:hover:text-ink"
    >
      <SkipForward size={18} aria-hidden />
    </button>
  );
}

// Accessible scrubber: a real <input type="range"> with the textbook key map (no drag required,
// SC 2.5.7), spoken aria-valuetext, current/total time, and optional chapter tick marks.
export function Scrubber({ track, ticks = false }: { track?: PlayerTrack; ticks?: boolean }) {
  const p = usePlayer();
  const isThis = !track || p.current?.id === track.id;
  const dur = (isThis ? p.duration : 0) || track?.durationSec || p.current?.durationSec || 0;
  const pos = isThis ? p.currentTime : 0;
  const chapters = (isThis ? p.current?.chapters : track?.chapters) ?? [];
  const seekTo = (s: number) => {
    if (isThis) p.seek(s);
    else if (track) p.playTrackAt(track, Math.max(0, s));
  };
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const big = e.shiftKey ? 15 : 5;
    let handled = true;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") seekTo(pos - big);
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") seekTo(pos + big);
    else if (e.key === "PageDown") seekTo(pos - 60);
    else if (e.key === "PageUp") seekTo(pos + 60);
    else if (e.key === "Home") seekTo(0);
    else if (e.key === "End") seekTo(dur);
    else handled = false;
    if (handled) e.preventDefault();
  };
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted">
        {formatDuration(pos)}
      </span>
      <div className="relative flex-1">
        <input
          type="range"
          min={0}
          max={dur || 1}
          step={1}
          value={Math.min(pos, dur || 1)}
          disabled={!dur}
          onChange={(e) => seekTo(Number(e.target.value))}
          onKeyDown={onKey}
          aria-label="Seek"
          aria-valuetext={`${spokenTime(pos)} of ${spokenTime(dur)}`}
          className="h-2 w-full cursor-pointer accent-[var(--color-brand)]"
        />
        {ticks &&
          dur > 0 &&
          chapters.map((c, i) => (
            <span
              key={i}
              aria-hidden
              title={c.title}
              className="pointer-events-none absolute top-1/2 h-2 w-px -translate-y-1/2 bg-ink/40"
              style={{ left: `${Math.min(100, (c.start / dur) * 100)}%` }}
            />
          ))}
      </div>
      <span className="w-12 shrink-0 font-mono text-[11px] tabular-nums text-muted">
        {formatDuration(dur)}
      </span>
    </div>
  );
}

// ── Secondary controls (progressive disclosure) ──────────────────────────────
export function SpeedMenuContent({ onSelect }: { onSelect?: () => void }) {
  const p = usePlayer();
  return (
    <div>
      <p className="px-2 pb-1 font-mono text-[11px] uppercase tracking-wide text-muted">Speed</p>
      <RadioMenu
        ariaLabel="Playback speed"
        options={SPEEDS.map((s) => ({ value: s, label: formatRate(s) }))}
        value={p.rate}
        equals={(a, b) => Math.abs(a - b) < 0.001}
        onSelect={(v) => {
          p.setRate(v);
          onSelect?.();
        }}
      />
      <div className="px-2 pt-2">
        <label htmlFor="speed-fine" className="sr-only">
          Fine playback speed
        </label>
        <input
          id="speed-fine"
          type="range"
          min={0.5}
          max={3}
          step={0.05}
          value={p.rate}
          onChange={(e) => p.setRate(Number(e.target.value))}
          aria-valuetext={`${p.rate.toFixed(2)} times speed`}
          className="h-1.5 w-full accent-[var(--color-brand)]"
        />
      </div>
    </div>
  );
}

export function SpeedControl({ openUp }: { openUp?: boolean }) {
  const p = usePlayer();
  return (
    <Popover
      openUp={openUp}
      label={`Playback speed, currently ${formatRate(p.rate)}`}
      panelLabel="Playback speed"
      active={Math.abs(p.rate - 1) > 0.001}
      buttonContent={<span className="tabular-nums">{formatRate(p.rate)}</span>}
    >
      {(close) => <SpeedMenuContent onSelect={close} />}
    </Popover>
  );
}

export function SleepMenuContent({ onSelect }: { onSelect?: () => void }) {
  const p = usePlayer();
  return (
    <div>
      <p className="px-2 pb-1 font-mono text-[11px] uppercase tracking-wide text-muted">Sleep timer</p>
      <RadioMenu
        ariaLabel="Sleep timer"
        options={SLEEP_OPTIONS}
        value={p.sleep}
        equals={(a, b) => a === b}
        onSelect={(v) => {
          p.setSleep(v);
          onSelect?.();
        }}
      />
    </div>
  );
}

export function SleepTimerControl({ openUp }: { openUp?: boolean }) {
  const p = usePlayer();
  return (
    <Popover
      openUp={openUp}
      label={`Sleep timer, ${sleepSummary(p.sleep)}`}
      panelLabel="Sleep timer"
      active={p.sleep != null}
      buttonContent={<Timer size={18} aria-hidden />}
    >
      {(close) => <SleepMenuContent onSelect={close} />}
    </Popover>
  );
}

// Desktop only (callers wrap in `hidden md:block`): on mobile, hardware buttons handle volume.
export function VolumeControl({ openUp, className }: { openUp?: boolean; className?: string }) {
  const p = usePlayer();
  const muted = p.muted || p.volume === 0;
  return (
    <div className={className}>
      <Popover
        openUp={openUp}
        label={muted ? "Volume, muted" : `Volume, ${Math.round(p.volume * 100)} percent`}
        panelLabel="Volume"
        active={muted}
        buttonContent={muted ? <VolumeX size={18} aria-hidden /> : <Volume2 size={18} aria-hidden />}
      >
        {() => (
          <div className="flex items-center gap-2 px-1">
            <button
              type="button"
              onClick={p.toggleMute}
              aria-label={p.muted ? "Unmute" : "Mute"}
              className="tap-target grid h-11 w-11 shrink-0 place-items-center rounded hover:text-accent"
            >
              {muted ? <VolumeX size={18} aria-hidden /> : <Volume2 size={18} aria-hidden />}
            </button>
            <label htmlFor="volume-range" className="sr-only">
              Volume
            </label>
            <input
              id="volume-range"
              data-autofocus
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={p.muted ? 0 : p.volume}
              onChange={(e) => p.setVolume(Number(e.target.value))}
              aria-valuetext={`${Math.round((p.muted ? 0 : p.volume) * 100)} percent`}
              className="h-1.5 w-32 accent-[var(--color-brand)]"
            />
          </div>
        )}
      </Popover>
    </div>
  );
}

export function ChaptersControl({ openUp }: { openUp?: boolean }) {
  const p = usePlayer();
  const chapters = p.current?.chapters ?? [];
  const cur = activeChapterIndex(chapters, p.currentTime);
  if (!chapters.length) return null;
  return (
    <Popover
      openUp={openUp}
      label="Chapters"
      panelLabel="Chapters"
      buttonContent={<ListTree size={18} aria-hidden />}
    >
      {(close) => (
        <ul role="menu" aria-label="Chapters" className="grid max-h-64 gap-0.5 overflow-y-auto">
          {chapters.map((c, i) => (
            <li key={i} role="none">
              <button
                type="button"
                role="menuitem"
                data-autofocus={i === (cur === -1 ? 0 : cur) ? "" : undefined}
                aria-current={i === cur ? "true" : undefined}
                onClick={() => {
                  p.seek(c.start);
                  close();
                }}
                className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-surface ${
                  i === cur ? "text-accent" : "text-ink"
                }`}
              >
                <span className="font-mono text-xs tabular-nums text-accent">{formatDuration(c.start)}</span>
                <span className="truncate">{c.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}

// Entry point to the read-along transcript. On the episode page it scrolls to the in-page panel; in
// the dock it navigates to the episode's transcript anchor.
export function TranscriptToggle({ slug, samePage }: { slug: string; samePage?: boolean }) {
  const cls =
    "tap-target inline-flex h-11 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-sm text-ink hover:border-brand";
  const inner = (
    <>
      <Captions size={16} aria-hidden /> Transcript
    </>
  );
  if (samePage) {
    return (
      <a href="#transcript" className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <Link to={`/${slug}#transcript`} className={cls}>
      {inner}
    </Link>
  );
}

// sr-only polite status for play/pause + chapter changes. Rendered once (in the dock) so it is never
// double-announced; the dock is present whenever something is loaded.
export function PlayerStatusLive() {
  const p = usePlayer();
  const chapters = p.current?.chapters ?? [];
  const idx = activeChapterIndex(chapters, p.currentTime);
  const chap = idx >= 0 ? chapters[idx] : null;
  const status = p.errored
    ? "Error loading audio"
    : p.buffering
      ? "Buffering"
      : p.isPlaying
        ? `Playing${chap ? `, ${chap.title}` : ""}`
        : "Paused";
  return (
    <div aria-live="polite" className="sr-only">
      {status}
    </div>
  );
}
