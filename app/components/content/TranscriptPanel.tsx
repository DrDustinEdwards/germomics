import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Copy, Check, ArrowDownToLine } from "lucide-react";
import { usePlayer, activeChapterIndex } from "~/components/player/player-context";
import { formatDuration } from "~/lib/format";
import { parseVtt, toParagraphs, parseCueText } from "~/lib/vtt";
import type { PlayerTrack } from "~/lib/types";

// Read-along transcript. The stored value is raw WebVTT; we parse it, group caption cues into
// readable paragraphs (keeping per-cue start times), and render speaker labels + non-verbal cues.
// Highlight is driven by the browser's native TextTrack: we mirror the cues onto a hidden metadata
// track on the shared <audio> element and follow cuechange/activeCues (the textbook mechanism),
// falling back to the playhead when VTTCue is unavailable. Click any line to seek + play. The active
// line auto-scrolls into view (respecting prefers-reduced-motion); when the reader scrolls away a
// "jump to current" affordance appears. Search filters the transcript; copy adds attribution + a
// timestamp deep link (tied to share-at-timestamp via ?t=).

function highlightTerm(text: string, q: string): React.ReactNode {
  if (!q) return text;
  const lower = text.toLowerCase();
  const out: React.ReactNode[] = [];
  let from = 0;
  let pos = lower.indexOf(q);
  if (pos === -1) return text;
  while (pos !== -1) {
    if (pos > from) out.push(text.slice(from, pos));
    out.push(
      <mark key={pos} className="rounded bg-accent/30 text-ink">
        {text.slice(pos, pos + q.length)}
      </mark>,
    );
    from = pos + q.length;
    pos = lower.indexOf(q, from);
  }
  if (from < text.length) out.push(text.slice(from));
  return out;
}

export function TranscriptPanel({ transcript, track }: { transcript: string; track: PlayerTrack }) {
  const p = usePlayer();
  const cues = useMemo(() => parseVtt(transcript), [transcript]);
  const paragraphs = useMemo(() => toParagraphs(cues), [cues]);
  const chapters = track.chapters ?? [];
  const isThis = p.current?.id === track.id;

  const [activeStart, setActiveStart] = useState<number | null>(null);
  const [following, setFollowing] = useState(true);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const programmaticScroll = useRef(false);
  const [panelVisible, setPanelVisible] = useState(false);
  const scrollFlagTimer = useRef<number | undefined>(undefined);

  const hasNativeCue = typeof window !== "undefined" && typeof VTTCue !== "undefined";

  // Native TextTrack highlight: mirror cues onto a single reusable hidden metadata track and follow
  // cuechange. Only while this episode is the one playing.
  useEffect(() => {
    const audio = p.audioRef.current;
    if (!isThis || !audio || !hasNativeCue || !cues.length) {
      if (!isThis) setActiveStart(null);
      return;
    }
    let tt: TextTrack | null = null;
    for (let i = 0; i < audio.textTracks.length; i++) {
      if (audio.textTracks[i].label === "germomics-transcript") tt = audio.textTracks[i];
    }
    if (!tt) tt = audio.addTextTrack("metadata", "germomics-transcript");
    tt.mode = "hidden";
    const clear = () => {
      if (tt && tt.cues) for (let i = tt.cues.length - 1; i >= 0; i--) tt.removeCue(tt.cues[i]);
    };
    clear();
    for (const c of cues) {
      try {
        tt.addCue(new VTTCue(c.start, c.end > c.start ? c.end : c.start + 0.1, ""));
      } catch {
        /* skip malformed cue */
      }
    }
    const onChange = () => {
      const list = tt?.activeCues;
      const last = list && list.length ? list[list.length - 1] : null;
      setActiveStart(last ? last.startTime : null);
    };
    tt.addEventListener("cuechange", onChange);
    onChange();
    return () => {
      tt?.removeEventListener("cuechange", onChange);
      clear();
      if (tt) tt.mode = "disabled";
    };
  }, [isThis, cues, hasNativeCue, p.audioRef]);

  // Fallback highlight from the playhead when VTTCue is unavailable.
  useEffect(() => {
    if (hasNativeCue) return;
    if (!isThis) {
      setActiveStart(null);
      return;
    }
    let active: number | null = null;
    for (const c of cues) {
      if (c.start <= p.currentTime) active = c.start;
      else break;
    }
    setActiveStart(active);
  }, [hasNativeCue, isThis, cues, p.currentTime]);

  // Center the active cue WITHIN the transcript's own scroll box. Scrolls the container element only
  // (scrollBy on it), so the document/window is never moved; a no-op when the box can't scroll or the
  // cue is already centered. Reduced motion snaps instead of animating.
  const centerCueInContainer = useCallback((start: number | null) => {
    const container = containerRef.current;
    if (start == null || !container) return;
    const target = container.querySelector<HTMLElement>(`[data-cue="${start}"]`);
    if (!target) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cRect = container.getBoundingClientRect();
    const tRect = target.getBoundingClientRect();
    const delta = tRect.top - cRect.top - (container.clientHeight - tRect.height) / 2;
    if (Math.abs(delta) < 2) return;
    programmaticScroll.current = true;
    container.scrollBy({ top: delta, behavior: reduce ? "auto" : "smooth" });
    if (scrollFlagTimer.current) window.clearTimeout(scrollFlagTimer.current);
    scrollFlagTimer.current = window.setTimeout(() => {
      programmaticScroll.current = false;
    }, reduce ? 60 : 700);
  }, []);

  // Keep the active line in view, but ONLY inside the transcript box and ONLY while the panel is open
  // (rendered) and on screen. Pressing play with the transcript collapsed or off screen does nothing,
  // so the page never jumps to the transcript.
  useEffect(() => {
    if (!following || activeStart == null || query || !panelVisible) return;
    centerCueInContainer(activeStart);
  }, [activeStart, following, query, panelVisible, centerCueInContainer]);

  // A manual scroll INSIDE the transcript hands control back to the reader. The IntersectionObserver
  // on the box gates the auto-scroll above: it tracks whether the panel is open (rendered) and on
  // screen, so a collapsed or off-screen transcript never triggers a scroll.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onScroll = () => {
      if (!programmaticScroll.current) setFollowing(false);
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    const io = new IntersectionObserver(
      (entries) => setPanelVisible(entries[0]?.isIntersecting ?? false),
      { threshold: 0 },
    );
    io.observe(container);
    return () => {
      container.removeEventListener("scroll", onScroll);
      io.disconnect();
    };
  }, []);

  const jump = (seconds: number) => {
    if (isThis) p.seek(seconds);
    else p.playTrackAt(track, seconds);
  };

  const jumpToCurrent = () => {
    setFollowing(true);
    centerCueInContainer(activeStart);
  };

  const copyQuote = async () => {
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    let text = sel ? sel.toString().trim() : "";
    if (!text) return;
    const words = text.split(/\s+/);
    if (words.length > 200) text = words.slice(0, 200).join(" ") + "…";
    // Timestamp = the cue the selection starts in, else the current playhead.
    let t = Math.floor(isThis ? p.currentTime : 0);
    let node: Node | null = sel?.anchorNode ?? null;
    let el = node instanceof Element ? node : node?.parentElement ?? null;
    while (el && !el.getAttribute("data-cue")) el = el.parentElement;
    if (el) t = Math.floor(Number(el.getAttribute("data-cue")));
    const url = `${window.location.origin}/${track.slug}?t=${t}`;
    try {
      await navigator.clipboard.writeText(`${text}\n\nFrom "${track.title}" on germomics: ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  };

  // Fallback: unparseable VTT shows as plain text rather than nothing.
  if (!cues.length) {
    return <p className="whitespace-pre-wrap text-muted">{transcript}</p>;
  }

  const q = query.trim().toLowerCase();
  const shown = q
    ? paragraphs.filter((para) => para.some((c) => c.text.toLowerCase().includes(q)))
    : paragraphs;
  const matches = q
    ? paragraphs.reduce((n, para) => n + para.filter((c) => c.text.toLowerCase().includes(q)).length, 0)
    : 0;

  let lastChapter = -1;
  let lastSpeaker: string | null = null;

  return (
    <div>
      {/* Toolbar: search + copy */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
          <Search size={14} aria-hidden className="text-muted" />
          <label htmlFor="transcript-search" className="sr-only">Search transcript</label>
          <input
            id="transcript-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transcript"
            className="w-40 bg-transparent text-sm outline-none"
          />
        </div>
        {q ? (
          <span className="font-mono text-xs text-muted">
            {matches} match{matches === 1 ? "" : "es"}
          </span>
        ) : null}
        <button
          type="button"
          onClick={copyQuote}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-mono text-xs hover:border-accent hover:text-accent"
        >
          {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          {copied ? "Copied" : "Copy with link"}
        </button>
      </div>

      <div
        ref={containerRef}
        className="max-h-[70vh] space-y-4 overflow-y-auto overscroll-contain rounded-xl border border-border p-4"
      >
        {shown.map((para, pi) => {
          const startSec = para[0].start;
          const chap = activeChapterIndex(chapters, startSec);
          const showChapter = !q && chap !== -1 && chap !== lastChapter;
          if (showChapter) lastChapter = chap;
          const firstParsed = parseCueText(para[0].text);
          const speaker = firstParsed.speaker;
          const showSpeaker = speaker && speaker !== lastSpeaker;
          if (speaker) lastSpeaker = speaker;

          return (
            <div key={pi}>
              {showChapter ? (
                <p className="mb-1 mt-2 font-display text-sm font-semibold text-brand">{chapters[chap].title}</p>
              ) : null}
              {showSpeaker ? (
                <p className="font-mono text-[11px] uppercase tracking-wide text-accent">{speaker}</p>
              ) : null}
              <p className="leading-relaxed">
                <button
                  type="button"
                  onClick={() => jump(startSec)}
                  className="mr-2 align-baseline font-mono text-xs tabular-nums text-accent hover:underline"
                  aria-label={`Play from ${formatDuration(startSec)}`}
                >
                  {formatDuration(startSec)}
                </button>
                {para.map((c, ci) => {
                  const parsed = parseCueText(c.text);
                  const active = c.start === activeStart;
                  return (
                    <button
                      key={ci}
                      type="button"
                      data-cue={c.start}
                      onClick={() => jump(c.start)}
                      aria-current={active ? "true" : undefined}
                      title={formatDuration(c.start)}
                      className={`cursor-pointer rounded px-0.5 text-left transition motion-reduce:transition-none ${
                        active ? "bg-surface text-ink" : "hover:bg-surface/60"
                      } ${parsed.nonVerbal ? "italic text-muted" : ""}`}
                    >
                      {highlightTerm(parsed.text, q)}{" "}
                    </button>
                  );
                })}
              </p>
            </div>
          );
        })}
        {q && shown.length === 0 ? <p className="text-muted">No matches.</p> : null}
      </div>

      {/* Jump to current line (appears when the reader has scrolled away while playing) */}
      {isThis && !following && activeStart != null && !q ? (
        <button
          type="button"
          onClick={jumpToCurrent}
          className="sticky bottom-4 ml-auto mt-3 flex items-center gap-1.5 rounded-full border border-accent bg-card px-3 py-1.5 font-mono text-xs text-accent shadow-sm"
        >
          <ArrowDownToLine size={14} aria-hidden /> Jump to current
        </button>
      ) : null}
    </div>
  );
}
