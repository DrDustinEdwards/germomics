// The single public body renderer, reused by BOTH the article page and the episode page (spec
// §B/§H — built once). Renders the stored sanitized HTML, injects stable ids on h2/h3 so the
// table of contents can anchor to them, and styles flow content (incl. callouts authored as
// <aside class="callout">). The author is the only writer and the HTML is sanitized on save,
// so it is rendered directly.
import { useMemo } from "react";
import { addHeadingIds, demoteHeadings } from "~/lib/seo";

const PROSE =
  "max-w-none text-[1.05rem] leading-relaxed " +
  "[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 " +
  "[&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:scroll-mt-24 " +
  "[&_h3]:mt-7 [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:scroll-mt-24 " +
  "[&_h4]:mt-6 [&_h4]:font-display [&_h4]:text-lg [&_h4]:font-semibold " +
  "[&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 " +
  "[&_blockquote]:my-5 [&_blockquote]:border-l-2 [&_blockquote]:border-brand [&_blockquote]:pl-4 [&_blockquote]:italic " +
  "[&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-surface [&_pre]:p-4 [&_pre]:text-sm " +
  "[&_code]:font-mono [&_code]:text-[0.9em] " +
  "[&_img]:my-6 [&_img]:rounded-xl [&_img]:border [&_img]:border-border " +
  // Figures sit inline within the article column (not full-bleed), centered, the rendered width
  // capped to the image's own width attribute (520px lead illustration, 400px photos) and scaling
  // down on narrow screens. Caption below in small muted text, credit on its own line.
  "[&_figure]:my-6 [&_figure_img]:mx-auto [&_figure_img]:block [&_figure_img]:my-0 [&_figure_img]:h-auto [&_figure_img]:max-w-full " +
  "[&_figcaption]:mt-2 [&_figcaption]:text-center [&_figcaption]:text-sm [&_figcaption]:text-muted " +
  "[&_figcaption_.cr]:mt-0.5 [&_figcaption_.cr]:block [&_figcaption_.cr]:text-xs [&_figcaption_.cr]:text-muted " +
  "[&_hr]:my-8 [&_hr]:border-border " +
  "[&_aside.callout]:my-6 [&_aside.callout]:rounded-xl [&_aside.callout]:border [&_aside.callout]:border-border " +
  "[&_aside.callout]:bg-surface [&_aside.callout]:p-4 [&_aside.callout]:not-italic";

export function BodyRenderer({ html, className = "" }: { html: string; className?: string }) {
  // Demote body headings (so the page keeps one h1) before injecting TOC anchor ids.
  const withIds = useMemo(() => addHeadingIds(demoteHeadings(html ?? "")), [html]);
  return (
    <div className={`${PROSE} ${className}`} dangerouslySetInnerHTML={{ __html: withIds }} />
  );
}
