// Supporting pieces for the redesigned episode page. All grouped here to keep the route lean; each is
// small and client-side. Every motion (smooth scroll, auto-scroll, progress bar) is reduced-motion
// aware. now-playing highlights use the cyan accent only.
import { useEffect, useState } from "react";
import { useModalDialog } from "~/lib/modal-dialog";
import { ChevronRight, ExternalLink, X } from "lucide-react";
import type { KeyMoment, Source, Host, Chapter } from "~/lib/types";
import type { TocItem } from "~/lib/seo";
import type { PlayerTrack } from "~/lib/types";
import { usePlayer } from "~/components/player/player-context";
import { GMark } from "~/components/brand/GMark";
import { imageFor, type ImageSet } from "~/lib/images";
import { Picture } from "./Picture";

function usePrefersReducedMotion(): boolean {
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
      <div className="h-full bg-gradient-to-r from-brand to-accent" style={{ width: `${pct}%` }} />
    </div>
  );
}

// ── "In this episode" key moments ────────────────────────────────────────────
export function KeyMoments({ moments, track }: { moments: KeyMoment[]; track: PlayerTrack }) {
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
                  active ? "border-accent bg-accent/10" : "border-border bg-card hover:border-brand"
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
      <nav
        aria-label="On this page"
        className="sticky top-24 hidden max-h-[calc(100vh-8rem)] overflow-auto lg:block"
      >
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
    <section id="sources" className="mt-12 scroll-mt-20">
      {/* Collapsed by default to match the Transcript section directly below it; the two read as a
          matched pair. The full content (including the legally-required CC BY music attribution and the
          image credits) stays server-rendered inside <details> so it's present in view-source while
          collapsed, not lazy-mounted on open. */}
      <details>
        <summary className="mb-3 cursor-pointer font-display text-xl font-semibold">
          Sources and Credits
        </summary>
        <ol className="space-y-2 text-sm">
          {sources.map((s, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-muted">
              <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[0.6875rem] uppercase tracking-wide text-muted">
                {SOURCE_KIND[s.type] ?? s.type}
              </span>
              {s.url ? (
                <a
                  href={s.url}
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  {s.title}
                  <ExternalLink size={12} aria-hidden />
                  <span className="sr-only"> (another site)</span>
                </a>
              ) : (
                <span className="text-ink">{s.title}</span>
              )}
              {s.authors ? <span>{s.authors}</span> : null}
              {s.publisher ? <span>{s.publisher}</span> : null}
              {s.license ? <span className="font-mono text-[0.6875rem]">{s.license}</span> : null}
              {s.note ? <span className="italic">{s.note}</span> : null}
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}

// ── Hosts byline ─────────────────────────────────────────────────────────────
export function Hosts({ hosts, images }: { hosts: Host[]; images?: ImageSet }) {
  if (!hosts.length) return null;
  return (
    <section aria-labelledby="hosts" className="mt-12">
      <h2 id="hosts" className="mb-3 font-display text-xl font-semibold">
        Hosts
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {hosts.map((h) => (
          <div
            key={h.name}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
          >
            {h.img ? (
              <Picture
                src={h.img}
                image={imageFor(images, "avatar", h.img)}
                alt={h.name}
                width={48}
                height={48}
                className="h-12 w-12 shrink-0 rounded-full border border-border object-cover"
              />
            ) : (
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-border bg-surface">
                <GMark className="h-6 w-auto" />
              </span>
            )}
            <div className="min-w-0">
              {h.href ? (
                <a
                  href={h.href}
                  rel="me"
                  className="font-display font-medium text-ink hover:text-brand"
                >
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
      <h2 id="chapters" className="mb-3 font-display text-xl font-semibold">
        Chapters
      </h2>
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

// ── Click-to-enlarge lightbox for body figures ───────────────────────────────
// Enhances every <figure><img> in the rendered body into an accessible "view larger" trigger, then
// opens the full-size image in a native modal dialog (Lightbox, below). No new dependency.
function largestSrc(img: HTMLImageElement): string {
  const srcset = img.getAttribute("srcset");
  if (srcset) {
    let best = "";
    let bestW = -1;
    for (const part of srcset.split(",")) {
      const [url, descriptor] = part.trim().split(/\s+/);
      const w = descriptor && /^\d+w$/.test(descriptor) ? parseInt(descriptor, 10) : 0;
      if (url && w >= bestW) {
        bestW = w;
        best = url;
      }
    }
    if (best) return best;
  }
  return img.currentSrc || img.src;
}

export function FigureLightbox({
  bodyRef,
  deps,
}: {
  bodyRef: React.RefObject<HTMLElement | null>;
  deps: unknown[];
}) {
  const [open, setOpen] = useState<{ src: string; alt: string } | null>(null);

  // Turn each figure image into a keyboard- and pointer-activatable "enlarge" trigger.
  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    const imgs = Array.from(root.querySelectorAll<HTMLImageElement>("figure img"));
    const openFrom = (img: HTMLImageElement) => {
      // Focus the trigger (the link around the picture, or the picture itself) first: a click does
      // not focus a link in Safari, and the dialog hands focus back to whatever had it.
      (img.closest<HTMLElement>("a.image-link") ?? img).focus();
      setOpen({ src: largestSrc(img), alt: img.getAttribute("alt") || "" });
    };
    const onClick = (e: Event) => openFrom(e.currentTarget as HTMLImageElement);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openFrom(e.currentTarget as HTMLImageElement);
      }
    };
    // Prelum wraps a picture in a link to its original (a.image-link), which already takes focus and Enter: that
    // link opens the lightbox instead, and keeps its href for a reader without script.
    const onLink = (e: Event) => {
      const img = (e.currentTarget as HTMLElement).querySelector("img");
      if (!img) return;
      e.preventDefault();
      openFrom(img);
    };
    const links: HTMLAnchorElement[] = [];
    for (const img of imgs) {
      const link = img.closest<HTMLAnchorElement>("a.image-link");
      img.style.cursor = "zoom-in";
      if (link) {
        link.setAttribute("aria-label", `Enlarge image: ${img.getAttribute("alt") || "image"}`);
        link.addEventListener("click", onLink);
        links.push(link);
        continue;
      }
      img.setAttribute("role", "button");
      img.setAttribute("tabindex", "0");
      img.setAttribute("aria-label", `Enlarge image: ${img.getAttribute("alt") || "image"}`);
      img.addEventListener("click", onClick);
      img.addEventListener("keydown", onKey as EventListener);
    }
    return () => {
      for (const link of links) link.removeEventListener("click", onLink);
      for (const img of imgs) {
        img.removeEventListener("click", onClick);
        img.removeEventListener("keydown", onKey as EventListener);
      }
    };
    // oxlint-disable-next-line react/exhaustive-deps -- the caller's deps name the body this watches
  }, deps);

  if (!open) return null;
  return <Lightbox image={open} onClose={() => setOpen(null)} />;
}

// The enlarged image: a native modal <dialog> the size of the image (useModalDialog), so Esc, the
// back gesture and a tap on the dimmed backdrop close it, Tab stays on its one control, and focus
// returns to the figure that opened it. The fade in is motion-safe only.
function Lightbox({
  image,
  onClose,
}: {
  image: { src: string; alt: string };
  onClose: () => void;
}) {
  const ref = useModalDialog(onClose);
  return (
    <dialog
      ref={ref}
      closedby="any"
      aria-label={image.alt || "Enlarged image"}
      className="m-auto max-h-[90dvh] max-w-[calc(100%-2rem)] overflow-visible bg-transparent p-0 backdrop:bg-black/80 backdrop:backdrop-blur-sm motion-safe:transition-opacity motion-safe:duration-150 motion-safe:starting:opacity-0"
    >
      <img
        src={image.src}
        alt={image.alt}
        className="block max-h-[90dvh] max-w-full rounded-lg border border-white/20 object-contain shadow-2xl"
      />
      {/* Fixed to the screen's corner, not the image's; the dialog has no transform, so the
          viewport is its containing block. */}
      <button
        type="button"
        autoFocus
        onClick={onClose}
        aria-label="Close enlarged image"
        className="tap-target fixed right-3 top-3 grid h-11 w-11 place-items-center rounded-full border border-white/30 bg-black/50 text-white hover:bg-black/70"
      >
        <X size={20} aria-hidden />
      </button>
    </dialog>
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
    // oxlint-disable-next-line react/exhaustive-deps -- the caller's deps name the body this watches
  }, deps);
}
