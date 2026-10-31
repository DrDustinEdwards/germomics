// The single public body renderer, reused by the article page, the episode page and the content pages (spec
// §B/§H, built once). It shows HTML Prelum rendered from the stored Markdown (app/lib/render.server.ts), which is
// safe by construction and checked (assertSafe), so it is rendered directly. Prelum gives each h2 and h3 its id and
// a "#" anchor; the headings are demoted one level here, so the page keeps its own h1 and h2s. The classes below
// style Prelum's output (README, "The markdown pipeline") in the germomics palette.
import { useMemo } from "react";
import { demoteHeadings } from "~/lib/seo";

const PROSE =
  "max-w-none text-[1.05rem] leading-relaxed " +
  "[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 " +
  // Heading ladder: clear, legible steps in size, weight, and top spacing so the section hierarchy
  // reads at a glance. Body headings are demoted one level at render (authored ## -> h3, ### -> h4),
  // so h3/h4 carry the real section/subsection distinction; h2 covers the rare top-level case.
  "[&_h2]:mt-12 [&_h2]:mb-3 [&_h2]:font-display [&_h2]:text-3xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:scroll-mt-24 " +
  "[&_h3]:mt-10 [&_h3]:mb-2 [&_h3]:font-display [&_h3]:text-2xl [&_h3]:font-semibold [&_h3]:scroll-mt-24 " +
  "[&_h4]:mt-6 [&_h4]:mb-1 [&_h4]:font-display [&_h4]:text-base [&_h4]:font-semibold [&_h4]:uppercase [&_h4]:tracking-wide [&_h4]:scroll-mt-24 " +
  "[&_h5]:mt-5 [&_h5]:mb-1 [&_h5]:font-display [&_h5]:text-sm [&_h5]:font-semibold " +
  // The "#" link Prelum appends to each heading: quiet until the heading is hovered or the link has focus.
  "[&_.heading-anchor]:ml-2 [&_.heading-anchor]:font-normal [&_.heading-anchor]:text-muted [&_.heading-anchor]:no-underline [&_.heading-anchor]:opacity-0 " +
  "[&_.heading-anchor:focus-visible]:opacity-100 [&_:is(h2,h3,h4,h5,h6):hover_.heading-anchor]:opacity-100 [&_.heading-anchor:hover]:text-accent " +
  "[&_p]:my-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 " +
  "[&_blockquote]:my-5 [&_blockquote]:border-l-2 [&_blockquote]:border-brand [&_blockquote]:pl-4 [&_blockquote]:italic " +
  "[&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-surface [&_pre]:p-4 [&_pre]:text-sm " +
  "[&_code]:font-mono [&_code]:text-[0.9em] " +
  "[&_.code-frame]:my-5 [&_.code-frame_pre]:my-0 [&_.code-title]:mb-1 [&_.code-title]:font-mono [&_.code-title]:text-xs [&_.code-title]:text-muted " +
  "[&_img]:my-6 [&_img]:rounded-xl [&_img]:border [&_img]:border-border " +
  // Figures sit inline within the article column (not full-bleed), centered, at most 400px wide (the photos) or
  // 520px (width=wide, the lead illustration), scaling down on narrow screens. The picture links to its original
  // (image-link), which the lightbox opens in place when script runs. Caption below in small muted text, credit
  // (figure-credit) on its own line.
  "[&_figure]:my-6 [&_figure_img]:mx-auto [&_figure_img]:block [&_figure_img]:my-0 [&_figure_img]:h-auto [&_figure_img]:max-w-full " +
  "[&_figure:not(.width-wide):not(.width-full)_img]:max-w-[min(100%,400px)] [&_figure.width-wide_img]:max-w-[min(100%,520px)] " +
  "[&_a.image-link]:block [&_a.image-link]:no-underline [&_picture]:block " +
  "[&_figcaption]:mt-2 [&_figcaption]:text-center [&_figcaption]:text-sm [&_figcaption]:text-muted [&_figcaption_p]:my-0 " +
  "[&_figcaption_.figure-credit]:mt-0.5 [&_figcaption_.figure-credit]:block [&_figcaption_.figure-credit]:text-xs [&_figcaption_.figure-credit]:text-muted " +
  // A figure's dark-theme twin (:::figure{dark}): none is written yet, so the light drawing shows in both themes.
  "[&_.figure-dark]:hidden " +
  "[&_.gallery]:my-6 [&_.gallery-grid]:grid [&_.gallery-grid]:grid-cols-2 [&_.gallery-grid]:gap-3 sm:[&_.gallery-grid]:grid-cols-3 [&_.gallery_img]:my-0 [&_.gallery_img]:w-full [&_.gallery_img]:h-auto " +
  "[&_hr]:my-8 [&_hr]:border-border " +
  // Callouts (> [!NOTE] and its kin), and the older <aside class="callout"> an unconverted body may still hold. An
  // unconfirmed item in the bio is written as a note callout titled "Editor note" (CLAUDE.md rule 7).
  "[&_.callout]:my-6 [&_.callout]:rounded-xl [&_.callout]:border [&_.callout]:border-border [&_.callout]:bg-surface [&_.callout]:p-4 [&_.callout]:not-italic " +
  "[&_.callout_p]:my-2 [&_.callout-title]:font-display [&_.callout-title]:font-semibold [&_.callout-title]:text-accent " +
  "[&_.callout-warning]:border-amber-500/50 [&_.callout-caution]:border-brand " +
  "[&_.table-scroll]:my-6 [&_.table-scroll]:overflow-x-auto [&_table]:w-full [&_table]:text-sm [&_th]:border-b [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_td]:border-b [&_td]:border-border [&_td]:px-3 [&_td]:py-2 " +
  "[&_.post-details]:my-5 [&_.post-details]:rounded-xl [&_.post-details]:border [&_.post-details]:border-border [&_.post-details]:p-4 [&_.post-details_summary]:cursor-pointer [&_.post-details_summary]:font-display [&_.post-details_summary]:font-semibold " +
  "[&_.faq]:my-6 [&_.faq_dt]:mt-4 [&_.faq_dt]:font-display [&_.faq_dt]:font-semibold [&_.faq_dd]:mt-1 " +
  "[&_.media]:my-6 [&_.media_video]:w-full [&_.media_video]:rounded-xl [&_.media_audio]:w-full [&_.media-transcript]:mt-2 [&_.media-transcript]:text-sm " +
  "[&_.embed]:my-6 [&_.embed-link]:inline-flex [&_.embed-link]:rounded-full [&_.embed-link]:border [&_.embed-link]:border-border [&_.embed-link]:bg-card [&_.embed-link]:px-4 [&_.embed-link]:py-2 [&_.embed-link]:no-underline " +
  "[&_.button-row]:my-5 [&_.button-row]:flex [&_.button-row]:flex-wrap [&_.button-row]:gap-2 [&_.button]:inline-flex [&_.button]:rounded-full [&_.button]:bg-brand [&_.button]:px-5 [&_.button]:py-2.5 [&_.button]:font-display [&_.button]:text-sm [&_.button]:text-white [&_.button]:no-underline " +
  "[&_.bookmark]:my-5 [&_.bookmark-link]:block [&_.bookmark-link]:rounded-xl [&_.bookmark-link]:border [&_.bookmark-link]:border-border [&_.bookmark-link]:bg-card [&_.bookmark-link]:p-4 [&_.bookmark-link]:no-underline [&_.bookmark-link:hover]:border-brand " +
  "[&_.bookmark-title]:block [&_.bookmark-title]:font-display [&_.bookmark-title]:font-semibold [&_.bookmark-title]:text-ink [&_.bookmark-description]:block [&_.bookmark-description]:text-sm [&_.bookmark-description]:text-muted [&_.bookmark-host]:block [&_.bookmark-host]:font-mono [&_.bookmark-host]:text-xs [&_.bookmark-host]:text-muted " +
  "[&_.footnotes]:mt-10 [&_.footnotes]:text-sm [&_.footnotes]:text-muted";

export function BodyRenderer({ html, className = "" }: { html: string; className?: string }) {
  const demoted = useMemo(() => demoteHeadings(html ?? ""), [html]);
  return <div className={`${PROSE} ${className}`} dangerouslySetInnerHTML={{ __html: demoted }} />;
}
