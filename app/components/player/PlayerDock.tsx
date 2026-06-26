// The persistent docked player. Built from the SAME shared controls as the episode-page surface
// (app/components/player/controls.tsx), so capability, icons, labels, and keyboard behavior match;
// only size and placement differ. Primary controls (play/pause, skip, scrubber + time) are always
// visible. Secondary controls (speed, volume, sleep, chapters) appear as inline popovers on desktop
// and inside an on-demand bottom sheet on mobile, instead of a permanent flat panel.
//
// The dock measures its own height into --player-h (ResizeObserver); the body reserves that as
// padding-bottom (app.css) so the footer always clears the fixed dock. Popovers open upward and the
// sheet is a separate overlay, so neither changes the measured dock height.
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { ChevronUp, X, AlertCircle, Loader2, ListTree } from "lucide-react";
import { usePlayer, activeChapterIndex } from "./player-context";
import { formatDuration } from "~/lib/format";
import {
  PlayPauseButton, SkipButton, NextButton, Scrubber, SpeedControl, VolumeControl,
  SleepTimerControl, ChaptersControl, SpeedMenuContent, SleepMenuContent, TranscriptToggle,
  PlayerStatusLive,
} from "./controls";

export function PlayerDock() {
  const p = usePlayer();
  const [sheetOpen, setSheetOpen] = useState(false);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const moreRef = useRef<HTMLButtonElement | null>(null);

  // Measure the dock's real height into --player-h (0 when nothing is loaded).
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

  // Close the mobile sheet if the viewport grows to desktop (the inline popovers take over there).
  useEffect(() => {
    if (!sheetOpen) return;
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => mq.matches && setSheetOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [sheetOpen]);

  if (!p.current) return null;

  const chapters = p.current.chapters ?? [];
  const curChapIdx = activeChapterIndex(chapters, p.currentTime);
  const curChap = curChapIdx >= 0 ? chapters[curChapIdx] : null;

  return (
    <div
      ref={dockRef}
      role="region"
      aria-label="Audio player"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <PlayerStatusLive />

      <div className="mx-auto max-w-5xl px-4">
        {/* Scrubber row with chapter ticks. */}
        <div className="pt-2">
          <Scrubber ticks />
        </div>

        {/* Control row. */}
        <div className="flex items-center gap-2 py-1.5">
          <div className="min-w-0 flex-1">
            <Link
              to={`/${p.current.slug}`}
              title={p.current.title}
              className="block truncate font-display text-sm font-medium text-ink hover:text-accent"
            >
              {p.current.title}
            </Link>
            <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-accent">
              {p.errored ? (
                <span className="flex items-center gap-1 text-brand">
                  <AlertCircle size={12} aria-hidden /> Error
                </span>
              ) : p.buffering ? (
                <span className="flex items-center gap-1">
                  <Loader2 size={12} aria-hidden className="motion-safe:animate-spin" /> Buffering
                </span>
              ) : (
                <span className="truncate">{curChap ? curChap.title : "now playing"}</span>
              )}
            </div>
          </div>

          {/* Primary transport. */}
          <div className="flex items-center gap-1">
            <SkipButton delta={-15} />
            <PlayPauseButton />
            <SkipButton delta={30} />
            <NextButton />
          </div>

          {/* Secondary controls: inline popovers on desktop. */}
          <div className="hidden items-center gap-1.5 md:flex">
            <SpeedControl openUp />
            <VolumeControl openUp />
            <SleepTimerControl openUp />
            <ChaptersControl openUp />
          </div>

          {/* Mobile: a single More button opens the bottom sheet. */}
          <button
            ref={moreRef}
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={sheetOpen}
            aria-label="More player controls"
            className={`tap-target grid h-11 w-11 place-items-center rounded-full md:hidden ${
              p.sleep != null ? "text-accent" : "text-ink hover:text-accent"
            }`}
          >
            <ChevronUp size={20} aria-hidden />
          </button>
        </div>
      </div>

      {sheetOpen ? <DockSheet onClose={() => setSheetOpen(false)} returnFocus={moreRef} /> : null}
    </div>
  );
}

// Mobile bottom sheet: a focus-trapped modal holding the secondary controls (speed, sleep, chapters,
// transcript). Esc and a backdrop tap close it; focus moves in on open and returns to the trigger on
// close. The slide-up is motion-safe only.
function DockSheet({
  onClose,
  returnFocus,
}: {
  onClose: () => void;
  returnFocus: React.RefObject<HTMLButtonElement | null>;
}) {
  const p = usePlayer();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const chapters = p.current?.chapters ?? [];
  const curChapIdx = activeChapterIndex(chapters, p.currentTime);

  useEffect(() => {
    const panel = panelRef.current;
    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button,[href],input,[tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const els = focusables();
        if (!els.length) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      returnFocus.current?.focus();
    };
  }, [onClose, returnFocus]);

  return (
    <div
      className="fixed inset-0 z-40 bg-black/40 md:hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Player controls"
        className="absolute inset-x-0 bottom-0 max-h-[75vh] space-y-4 overflow-y-auto rounded-t-2xl border-t border-border bg-surface p-4 motion-safe:transition-transform"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        <div className="flex items-center justify-between">
          <p className="font-display text-sm font-semibold">Player controls</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close player controls"
            className="tap-target grid h-11 w-11 place-items-center rounded-full text-ink hover:text-accent"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <SpeedMenuContent />
        <SleepMenuContent />

        {chapters.length > 0 ? (
          <div>
            <p className="flex items-center gap-1 px-2 pb-1 font-mono text-[11px] uppercase tracking-wide text-muted">
              <ListTree size={14} aria-hidden /> Chapters
            </p>
            <ul className="grid max-h-48 gap-0.5 overflow-y-auto">
              {chapters.map((c, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => {
                      p.seek(c.start);
                      onClose();
                    }}
                    aria-current={i === curChapIdx ? "true" : undefined}
                    className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-card ${
                      i === curChapIdx ? "text-accent" : "text-ink"
                    }`}
                  >
                    <span className="font-mono text-xs tabular-nums text-accent">{formatDuration(c.start)}</span>
                    <span className="truncate">{c.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {p.current ? (
          <div className="px-2">
            <TranscriptToggle slug={p.current.slug} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
