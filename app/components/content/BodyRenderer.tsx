// The one public body renderer. Prelum's HTML is checked (assertSafe), so it is rendered directly. In a post the
// headings are demoted one level so the page keeps its own h1 and h2s (.gm-headings-section); a content page keeps its
// levels and takes the same look one step up (.gm-headings-page). The look is app/prose.css.
import { useMemo } from "react";
import { markup } from "capsomer/behavior/trusted-html";
import "~/prose.css";

/** Demotes headings one level (h1->h2 ... h5->h6) at render time only: the stored HTML keeps Prelum's levels, which the feeds print. Heading ids are untouched. */
export function demoteHeadings(html: string): string {
  return html.replace(
    /<(\/?)h([1-5])(\b[^>]*)?>/gi,
    (_m, slash: string, n: string, attrs = "") => `<${slash}h${Number(n) + 1}${attrs}>`,
  );
}

/** `page`: a content page, whose headings keep their level. */
export function BodyRenderer({ html, page = false }: { html: string; page?: boolean }) {
  const shown = useMemo(() => (page ? (html ?? "") : demoteHeadings(html ?? "")), [html, page]);
  // Only a body with a lite embed loads the embeds island (app/islands/embeds.ts).
  const island = shown.includes("embed-link") ? "embeds" : undefined;
  return (
    <div
      className={`gm-prose ${page ? "gm-headings-page" : "gm-headings-section"}`}
      data-island={island}
      dangerouslySetInnerHTML={markup(shown)}
    />
  );
}
