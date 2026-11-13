// Supporting pieces for the redesigned episode page. All grouped here to keep the route lean; each is
// small and client-side. Every motion (smooth scroll, auto-scroll) is reduced-motion aware. now-playing
// highlights use the cyan accent only. The reading bar is Capsomer's CSS-only reading progress (PostDetail).
import { useEffect, useState } from "react";
import { Dialog } from "capsomer/react/dialog";
import { usePrefersReducedMotion } from "capsomer/react/hooks";
import { ExternalLink } from "lucide-react";
import type { Source } from "~/lib/types";
import type { TocItem } from "~/lib/seo";

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
    <ol className="gm-toc-list">
      {items.map((it) => (
        <li key={it.id} className={it.level === 3 ? "gm-chapters-sub" : undefined}>
          <a
            href={`#${it.id}`}
            onClick={(e) => onJump(e, it.id)}
            className="gm-chapter-link"
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
      <details className="gm-chapters-mobile">
        <summary className="gm-chapters-summary">Jump to</summary>
        <div className="gm-chapters-mobile-list">{list}</div>
      </details>
      {/* Desktop: a sticky rail. */}
      <nav aria-label="On this page" className="gm-chapters-rail">
        <p className="gm-rail-title">On this page</p>
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
    <section id="sources" className="gm-post-transcript">
      {/* Collapsed by default to match the Transcript section directly below it; the two read as a
          matched pair. The full content (including the legally-required CC BY music attribution and the
          image credits) stays server-rendered inside <details> so it's present in view-source while
          collapsed, not lazy-mounted on open. */}
      <details>
        <summary className="gm-post-summary">Sources and Credits</summary>
        <ol className="gm-sources-list">
          {sources.map((s, i) => (
            <li key={i} className="gm-source">
              <span className="gm-source-kind">{SOURCE_KIND[s.type] ?? s.type}</span>
              {s.url ? (
                <a href={s.url} className="gm-source-link">
                  {s.title}
                  <ExternalLink size={12} aria-hidden />
                  <span className="cap-sr-only"> (another site)</span>
                </a>
              ) : (
                <span className="gm-source-title">{s.title}</span>
              )}
              {s.authors ? <span>{s.authors}</span> : null}
              {s.publisher ? <span>{s.publisher}</span> : null}
              {s.license ? <span className="gm-source-license">{s.license}</span> : null}
              {s.note ? <span className="gm-source-note">{s.note}</span> : null}
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}

// ── Click-to-enlarge lightbox for body figures ───────────────────────────────
// Enhances every <figure><img> in the rendered body into an accessible "view larger" trigger, then
// opens the full-size image in Capsomer's dialog. No new dependency.
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
  // The image last opened, and whether it is open: the dialog stays mounted once opened, so it can close with its motion.
  const [view, setView] = useState<{ src: string; alt: string; open: boolean } | null>(null);

  // Turn each figure image into a keyboard- and pointer-activatable "enlarge" trigger.
  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    const imgs = Array.from(root.querySelectorAll<HTMLImageElement>("figure img"));
    const openFrom = (img: HTMLImageElement) => {
      // Focus the trigger (the link around the picture, or the picture itself) first: a click does
      // not focus a link in Safari, and the dialog hands focus back to whatever had it.
      (img.closest<HTMLElement>("a.image-link") ?? img).focus();
      setView({ src: largestSrc(img), alt: img.getAttribute("alt") || "", open: true });
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

  if (!view) return null;
  // Capsomer's dialog as the lightbox (capsomer/lightbox.css): Esc, the back gesture and a tap on the dimmed backdrop
  // close it, Tab stays inside, and focus returns to the figure that opened it.
  return (
    <Dialog
      open={view.open}
      onOpenChange={(open) => setView((v) => (v ? { ...v, open } : v))}
      className="cap-lightbox"
      aria-label={view.alt || "Enlarged image"}
      closeLabel="Close enlarged image"
    >
      <img src={view.src} alt={view.alt} />
    </Dialog>
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
