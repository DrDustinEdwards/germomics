// The single public body renderer, reused by the article page, the episode page and the content pages (spec
// §B/§H, built once). It shows HTML Prelum rendered from the stored Markdown (app/lib/render.server.ts), which is
// safe by construction and checked (assertSafe), so it is rendered directly. Prelum gives each h2 and h3 its id and
// a "#" anchor; in a post the headings are demoted one level here, so the page keeps its own h1 and h2s, and take the
// post's heading ladder (.gm-headings-section); a content page has no h2s of its own, so its headings keep their level
// and take the same look one step up (.gm-headings-page). The look is app/prose.css.
import { useMemo } from "react";
import { demoteHeadings } from "~/lib/seo";
import { markup } from "capsomer/behavior/trusted-html";
import "~/prose.css";

/** `page`: a content page, whose headings sit right under its h1 and keep their level. */
export function BodyRenderer({ html, page = false }: { html: string; page?: boolean }) {
  const shown = useMemo(() => (page ? (html ?? "") : demoteHeadings(html ?? "")), [html, page]);
  // A body with a lite embed loads the embeds island (app/islands/embeds.ts), so a page with none sends no script for it.
  const island = shown.includes("embed-link") ? "embeds" : undefined;
  return (
    <div
      className={`gm-prose ${page ? "gm-headings-page" : "gm-headings-section"}`}
      data-island={island}
      dangerouslySetInnerHTML={markup(shown)}
    />
  );
}
