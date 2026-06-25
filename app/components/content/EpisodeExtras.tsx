// Supporting pieces for the redesigned episode page. All grouped here to keep the route lean; each is
// small and client-side. Every motion (smooth scroll, auto-scroll, progress bar) is reduced-motion
// aware. now-playing highlights use the cyan accent only.
import { useEffect, useRef, useState } from "react";
import { Clock, ChevronRight, ExternalLink } from "lucide-react";
import type { KeyMoment, Source, Host, Chapter } from "~/lib/types";
import type { TocItem } from "~/lib/seo";
import type { PlayerTrack } from "~/lib/types";
import { usePlayer } from "~/components/player/player-context";
import { GMark } from "~/components/brand/GMark";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

function fmt(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ── Reading progress bar ─────────────────────────────────────────────────────
export function ReadingProgress() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setPct(max > 0 ? Math.min(100, Math.max(0, (h.scrollTop / max) * 100)) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-0.5" aria-hidden>
      <div
        className="h-full bg-gradient-to-r from-brand to-accent"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ── Hero cover with a branded fallback if the image is missing ────────────────
export function CoverImage({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className="grid aspect-square w-full place-items-center rounded-2xl border border-border bg-surface">
        <GMark className="h-1/3 w-auto" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      width={1400}
      height={1400}
      loading="eager"
      fetchPriority="high"
      decoding="async"
      onError={() => setFailed(true)}
      className="aspect-square w-full rounded-2xl border border-border object-cover"
    />
  );
}

// ── "In this episode" key moments ────────────────────────────────────────────
export function KeyMoments({
  moments,
  track,
}: {
  moments: KeyMoment[];
  track: PlayerTrack;
}) {
  const p = usePlayer();
  const reduced = usePrefersReducedMotion();
  const [toast, setToast] = useState<string | null>(null);
  const isActive = p.current?.id === track.id;
  const now = isActive ? p.currentTime : -1;

  const go = (m: KeyMoment) => {
    if (isActive) p.seek(m.seconds);
    else p.playTrackAt(track, m.seconds);
    document
      .getElementById("player")
      ?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    setToast(`Jumped to ${fmt(m.seconds)}`);
    window.setTimeout(() => setToast(null), 1800);
  };

  if (!moments.length) return null;
  return (
    <section aria-labelledby="key-moments" className="mt-10">
      <h2 id="key-moments" className="mb-3 font-display text-xl font-semibold">
        In this episode
      </h2>
      <ol className="grid gap-2 sm:grid-cols-2">
        {moments.map((m, i) => {
          const nextAt = moments[i + 1]?.seconds ?? Infinity;
          const active = now >= m.seconds && now < nextAt;
          return (
            <li key={`${m.seconds}-${i}`}>
              <button
                type="button"
                onClick={() => go(m)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                  active
                    ? "border-accent bg-accent/10"
                    : "border-border bg-card hover:border-brand"
                }`}
              >
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-xs tabular-nums ${
                    active ? "text-accent" : "text-brand"
                  }`}
                >
                  {fmt(m.seconds)}
                </span>
                <span className="text-sm text-ink">{m.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <div aria-live="polite" className="sr-only">
        {toast}
      </div>
      {toast ? (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-3 py-1.5 font-mono text-xs text-bg shadow-lg">
          {toast}
        </div>
      ) : null}
    </section>
  );
}

// ── Sticky table of contents with scroll-spy ─────────────────────────────────
export function EpisodeToc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string>("");
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (!items.length) return;
    const els = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => !!el);
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -65% 0px", threshold: 0 },
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [items]);

  const onJump = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    history.replaceState(null, "", `#${id}`);
    setActive(id);
  };

  if (items.length < 3) return null;

  const list = (
    <ol className="space-y-1 text-sm">
      {items.map((it) => (
        <li key={it.id} className={it.level === 3 ? "pl-3" : ""}>
          <a
            href={`#${it.id}`}
            onClick={(e) => onJump(e, it.id)}
            className={`block rounded px-2 py-1 ${
              active === it.id ? "bg-surface font-medium text-brand" : "text-muted hover:text-ink"
            }`}
            aria-current={active === it.id ? "true" : undefined}
          >
            {it.text}
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <>
      {/* Mobile: a collapsible jump-to control. */}
      <details className="mb-6 rounded-xl border border-border bg-surface p-3 lg:hidden">
        <summary className="cursor-pointer font-display text-sm font-semibold">Jump to</summary>
        <div className="mt-2">{list}</div>
      </details>
      {/* Desktop: a sticky rail. */}
      <nav aria-label="On this page" className="sticky top-24 hidden max-h-[calc(100vh-8rem)] overflow-auto lg:block">
        <p className="mb-2 font-display text-sm font-semibold">On this page</p>
        {list}
      </nav>
    </>
  );
}

// ── Sources / references ─────────────────────────────────────────────────────
const SOURCE_KIND: Record<string, string> = {
  credit: "Credit",
  music: "Music",
  image: "Image",
  article: "Article",
  book: "Book",
  web: "Web",
};

export function Sources({ sources }: { sources: Source[] }) {
  if (!sources.length) return null;
  return (
    <section aria-labelledby="sources" className="mt-12">
      <h2 id="sources" className="mb-3 font-display text-xl font-semibold">
        Sources and credits
      </h2>
      <ol className="space-y-2 text-sm">
        {sources.map((s, i) => (
          <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-muted">
            <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide text-muted">
              {SOURCE_KIND[s.type] ?? s.type}
            </span>
            {s.url ? (
              <a href={s.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-accent hover:underline">
                {s.title}
                <ExternalLink size={12} aria-hidden />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              <span className="text-ink">{s.title}</span>
            )}
            {s.authors ? <span>{s.authors}</span> : null}
            {s.publisher ? <span>{s.publisher}</span> : null}
            {s.license ? <span className="font-mono text-[11px]">{s.license}</span> : null}
            {s.note ? <span className="italic">{s.note}</span> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

// ── Hosts byline ─────────────────────────────────────────────────────────────
export function Hosts({ hosts }: { hosts: Host[] }) {
  if (!hosts.length) return null;
  return (
    <section aria-labelledby="hosts" className="mt-12">
      <h2 id="hosts" className="mb-3 font-display text-xl font-semibold">
        Hosts
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {hosts.map((h) => (
          <div key={h.name} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            {h.img ? (
              <img src={h.img} alt={h.name} width={48} height={48} loading="lazy" decoding="async" className="h-12 w-12 shrink-0 rounded-full border border-border object-cover" />
            ) : (
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-border bg-surface">
                <GMark className="h-6 w-auto" />
              </span>
            )}
            <div className="min-w-0">
              {h.href ? (
                <a href={h.href} target="_blank" rel="me noopener" className="font-display font-medium text-ink hover:text-brand">
                  {h.name}
                </a>
              ) : (
                <span className="font-display font-medium text-ink">{h.name}</span>
              )}
              {h.role ? <p className="font-mono text-xs text-muted">{h.role}</p> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Chapters list (current-chapter highlight) ────────────────────────────────
export function ChapterList({ chapters, track }: { chapters: Chapter[]; track: PlayerTrack }) {
  const p = usePlayer();
  const isActive = p.current?.id === track.id;
  const now = isActive ? p.currentTime : -1;
  const seek = (s: number) => (isActive ? p.seek(s) : p.playTrackAt(track, s));
  if (!chapters.length) return null;
  return (
    <section aria-labelledby="chapters" className="mt-10">
      <h2 id="chapters" className="mb-3 font-display text-xl font-semibold">Chapters</h2>
      <ol className="grid gap-1">
        {chapters.map((c, i) => {
          const nextAt = chapters[i + 1]?.start ?? Infinity;
          const on = now >= c.start && now < nextAt;
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => seek(c.start)}
                className={`flex w-full items-center gap-3 rounded px-2 py-1.5 text-left hover:bg-surface ${on ? "text-accent" : ""}`}
              >
                <span className="font-mono text-xs tabular-nums text-accent">{fmt(c.start)}</span>
                <span className={on ? "text-accent" : "text-ink"}>{c.title}</span>
                {on ? <ChevronRight size={14} aria-hidden className="ml-auto text-accent" /> : null}
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// Hide body figures whose image fails to load (e.g. before the binaries are deployed) so the article
// never shows a broken image. Reversible: when the asset exists the figure renders normally.
export function useHideBrokenFigures(ref: React.RefObject<HTMLElement | null>, deps: unknown[]) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const imgs = Array.from(root.querySelectorAll("figure img"));
    const onErr = (e: Event) => {
      const img = e.target as HTMLImageElement;
      const fig = img.closest("figure");
      if (fig) (fig as HTMLElement).style.display = "none";
    };
    for (const img of imgs) {
      const el = img as HTMLImageElement;
      if (el.complete && el.naturalWidth === 0) {
        const fig = el.closest("figure");
        if (fig) (fig as HTMLElement).style.display = "none";
      } else {
        el.addEventListener("error", onErr);
      }
    }
    return () => imgs.forEach((img) => img.removeEventListener("error", onErr));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
