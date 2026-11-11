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
import { Dialog, DialogBody, DialogHeader, DialogTitle } from "capsomer/react/dialog";
import { useMedia } from "capsomer/react/hooks";
import { Link } from "capsomer/react/link";
import { ChevronUp, X, AlertCircle, Loader2, ListTree } from "lucide-react";
import { usePlayer, activeChapterIndex } from "./player-context";
import { formatDuration } from "~/lib/format";
import {
  PlayPauseButton,
  SkipButton,
  NextButton,
  Scrubber,
  SpeedControl,
  VolumeControl,
  SleepTimerControl,
  ChaptersControl,
  SpeedMenuContent,
  SleepMenuContent,
  TranscriptToggle,
  PlayerStatusLive,
} from "./controls";

export function PlayerDock() {
  const p = usePlayer();
  const [sheetOpen, setSheetOpen] = useState(false);
  const dockRef = useRef<HTMLDivElement | null>(null);

  // Measure the dock's real height into --player-h (0 when nothing is loaded).
  const loaded = p.current;
  useEffect(() => {
    const root = document.documentElement;
    if (!loaded) {
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
  }, [loaded]);

  // The mobile sheet closes if the viewport grows to desktop (the inline popovers take over there): its dialog is shut
  // while the viewport is wide, and says so, which puts the state back to closed.
  const desktop = useMedia("(min-width: 768px)");

  if (!p.current) return null;

  const chapters = p.current.chapters ?? [];
  const curChapIdx = activeChapterIndex(chapters, p.currentTime);
  const curChap = curChapIdx >= 0 ? chapters[curChapIdx] : null;

  // Auto-hide while the loaded episode's own surface is on screen. The dock stays mounted (playback and
  // Media Session never break); it is only faded out, aria-hidden, and inert (not focusable). The status
  // live region sits OUTSIDE the hidden wrapper so announcements continue while the dock is hidden.
  const hidden = p.surfaceVisible;

  return (
    <>
      <PlayerStatusLive />
      <div
        ref={dockRef}
        role="region"
        aria-label="Audio player"
        aria-hidden={hidden || undefined}
        inert={hidden ? true : undefined}
        className={`fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur motion-safe:transition motion-safe:duration-300 ${
          hidden ? "pointer-events-none translate-y-2 opacity-0" : "translate-y-0 opacity-100"
        }`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
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
              <div className="flex items-center gap-1.5 font-mono text-[0.6875rem] uppercase tracking-wide text-accent">
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
              type="button"
              onClick={(e) => {
                // Safari does not focus a clicked button; the sheet hands focus back to it.
                e.currentTarget.focus();
                setSheetOpen(true);
              }}
              aria-haspopup="dialog"
              aria-expanded={sheetOpen && !desktop}
              aria-label="More player controls"
              className={`cap-tap-target grid h-11 w-11 place-items-center rounded-full md:hidden ${
                p.sleep != null ? "text-accent" : "text-ink hover:text-accent"
              }`}
            >
              <ChevronUp size={20} aria-hidden />
            </button>

            {/* Explicit dismiss: pause and end the session (distinct from auto-hide). */}
            <button
              type="button"
              onClick={p.dismiss}
              aria-label="Close player"
              className="cap-tap-target grid h-11 w-11 place-items-center rounded-full text-muted hover:text-ink"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        </div>

        <DockSheet open={sheetOpen && !desktop} onOpenChange={setSheetOpen} />
      </div>
    </>
  );
}

// Mobile bottom sheet: Capsomer's dialog as a bottom sheet (placement "bottom") holding the secondary controls (speed,
// sleep, chapters, transcript). Esc, the back gesture, a backdrop tap and a drag down on its header close it; the
// browser keeps focus inside and the dialog returns it to the More button. Its content is mounted while it is open.
function DockSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const p = usePlayer();
  const chapters = p.current?.chapters ?? [];
  const curChapIdx = activeChapterIndex(chapters, p.currentTime);
  const close = () => onOpenChange(false);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      placement="bottom"
      aria-label="Player controls"
      closeLabel="Close player controls"
      className="md:hidden"
    >
      <DialogHeader>
        <DialogTitle>Player controls</DialogTitle>
      </DialogHeader>
      {open ? (
        <DialogBody className="space-y-4">
          <SpeedMenuContent />
          <SleepMenuContent />

          {chapters.length > 0 ? (
            <div>
              <p className="flex items-center gap-1 px-2 pb-1 font-mono text-[0.6875rem] uppercase tracking-wide text-muted">
                <ListTree size={14} aria-hidden /> Chapters
              </p>
              <ul className="grid max-h-48 gap-0.5 overflow-y-auto">
                {chapters.map((c, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => {
                        p.seek(c.start);
                        close();
                      }}
                      aria-current={i === curChapIdx ? "true" : undefined}
                      className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-card ${
                        i === curChapIdx ? "text-accent" : "text-ink"
                      }`}
                    >
                      <span className="font-mono text-xs tabular-nums text-accent">
                        {formatDuration(c.start)}
                      </span>
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
        </DialogBody>
      ) : null}
    </Dialog>
  );
}
