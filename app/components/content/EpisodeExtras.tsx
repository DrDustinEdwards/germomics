// Supporting pieces for the redesigned episode page. All grouped here to keep the route lean; each is
// small and client-side. Every motion (smooth scroll, auto-scroll, progress bar) is reduced-motion
// aware. now-playing highlights use the cyan accent only.
import { useEffect, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import type { Source } from "~/lib/types";
import type { TocItem } from "~/lib/seo";

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
              <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] uppercase tracking-wide text-muted">
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
              {s.license ? <span className="font-mono text-[11px]">{s.license}</span> : null}
              {s.note ? <span className="italic">{s.note}</span> : null}
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}

// ── Click-to-enlarge lightbox for body figures ───────────────────────────────
// Enhances every <figure><img> in the rendered body into an accessible "view larger" trigger, then
// opens the full-size image in a modal overlay. No new dependency. Focus moves into the dialog and is
// trapped, Esc and a backdrop click close it, scroll is locked, and focus returns to the triggering
// image on close. The fade is suppressed under prefers-reduced-motion (motion-safe only).
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
  const [shown, setShown] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  // Turn each figure image into a keyboard- and pointer-activatable "enlarge" trigger.
  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    const imgs = Array.from(root.querySelectorAll<HTMLImageElement>("figure img"));
    const openFrom = (img: HTMLImageElement) => {
      // Focus goes back to what took it: the link around the picture, or the picture itself.
      triggerRef.current = img.closest<HTMLElement>("a.image-link") ?? img;
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

  // While open: lock scroll, focus the close button, trap Tab, Esc closes; restore focus on close.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => setShown(true));
    closeBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(null);
      } else if (e.key === "Tab") {
        // The close button is the only focusable control inside, so keep focus on it.
        e.preventDefault();
        closeBtnRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      setShown(false);
      triggerRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={open.alt || "Enlarged image"}
      className={`fixed inset-0 z-[60] grid place-items-center bg-black/80 p-4 backdrop-blur-sm motion-safe:transition-opacity motion-safe:duration-150 ${
        shown ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* The backdrop: a click outside the image closes it (Esc does too, above). */}
      <div aria-hidden="true" className="absolute inset-0" onClick={() => setOpen(null)} />
      <button
        ref={closeBtnRef}
        type="button"
        onClick={() => setOpen(null)}
        aria-label="Close enlarged image"
        className="tap-target absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full border border-white/30 bg-black/50 text-white hover:bg-black/70"
      >
        <X size={20} aria-hidden />
      </button>
      <img
        src={open.src}
        alt={open.alt}
        className="relative max-h-[90vh] max-w-full rounded-lg border border-white/20 object-contain shadow-2xl"
      />
    </div>
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
