// The one render of the site's writing: a post body or a page, stored as Markdown, rendered to HTML by Prelum's
// pipeline (render/nomath: `$` is a price here, so no KaTeX) with assertSafe on. Every save path stores the result
// beside the Markdown (renderFields), a public read serves the stored HTML while its renderVersion is Prelum's
// (storedBody), and the every-minute cron re-renders the rows an upgrade or a migration left behind (rerenderStale).
//
// IMAGES. A picture's size comes from the media library (D1 `media`), so the HTML carries its width and height, and
// its srcset and AVIF and WebP sources are /media copies (site-runtime ./image, app/lib/images.ts). A figure is shown
// at most 400px wide, the lead illustration (width=wide) at most 520px, as before. The link around a picture opens
// its original at /media, versioned like its sizes, as dustinedwards.info's pipeline writes it. An image the library
// does not hold is written as it is, unsized.
//
// NOT CONVERTED YET. A row whose renderVersion is NULL predates the move (drizzle/0016): its body is still the
// sanitized HTML the TipTap editor saved, and it is served as it is until the conversion or a save gives it Markdown.
//
// Prelum is imported on first use, so the public routes that only read stored HTML never load the pipeline.
import type * as Prelum from "@drdustinedwards/site-helpers/render/nomath";
import { diagramPack } from "~/lib/diagram-pack";
import { logEvent } from "@dustinedwards/site-runtime/log";
import { and, eq, isNotNull, like, ne, sql } from "drizzle-orm";
import { inList } from "@dustinedwards/site-runtime/d1";
import { rerenderEach, storedRender } from "@drdustinedwards/site-helpers/stored-render";
import { getDb } from "~/db/index.server";
import { contentBlocks, media, posts, type Post } from "~/db/schema";
import {
  drawsDiagrams,
  inDiagramContext,
  inlineBlogDiagrams,
  loadBlogDiagrams,
  type DiagramFiles,
} from "~/lib/blog-diagram.server";
import { imageKeyOf, images, mediaPath, type ImageUseName } from "~/lib/images";
import { SITE_ORIGIN } from "~/lib/site";
import type { BodyMeta } from "~/lib/types";

/** Prelum's RENDER_VERSION, kept here so a read can compare without loading the pipeline. */
export const RENDER_VERSION = "25";
// A Prelum upgrade that moves its version fails the typecheck here until this constant moves with it.
RENDER_VERSION satisfies typeof Prelum.RENDER_VERSION;

const EMPTY_META: BodyMeta = { toc: [], faq: [] };

/** One library picture's size, as the media table holds it. */
type MediaSize = {
  key: string;
  width: number | null;
  height: number | null;
  focus: string | null;
  /** The bytes' hash, the version a size URL carries (`v=`), so a replaced file is a new URL. */
  sha256: string | null;
};
/** The library rows for some keys. */
export type MediaLookup = (keys: string[]) => Promise<MediaSize[]>;

/** The media library in D1. */
export function libraryMedia(env: Env): MediaLookup {
  return async (keys) =>
    keys.length === 0
      ? []
      : getDb(env)
          .select({
            key: media.key,
            width: media.width,
            height: media.height,
            focus: media.focus,
            sha256: media.sha256,
          })
          .from(media)
          .where(inList(media.key, keys));
}

const escape = (s: string) => s.replace(/[.]/g, "\\.");
/** A stored image address in Markdown: /media/<key>, relative or on this origin. */
const IMAGE_URL = new RegExp(`(?:${escape(SITE_ORIGIN)})?/media/[^\\s"'()<>\\]]+`, "g");
const FIGURE_LINE = /^:::figure\{(.*)\}\s*$/gm;

/** The srcs of the figures written `width=wide`: the lead illustration, sized for 520px. */
function wideSources(body: string): Set<string> {
  const wide = new Set<string>();
  for (const [, attrs] of body.matchAll(FIGURE_LINE)) {
    const src = /\bsrc="([^"]*)"/.exec(attrs)?.[1];
    if (src && /\bwidth=(?:"wide"|wide\b)/.test(attrs)) wide.add(src);
  }
  return wide;
}

export type Rendered = {
  html: string;
  meta: BodyMeta;
  renderVersion: string;
  readingMinutes: number;
};

/**
 * Whether a post's largest picture sits above its body, so no body image is the page's LCP: an episode's cover art
 * (eager, in the hero) and a written post's cover (priority) both come first. Prelum then writes every body image
 * lazy with no fetchpriority (its `priority: { taken: true }`); measured live, an episode's first body image is at
 * y≈1,000 at 1440x900 and y≈1,600 at 390x844, below the fold. web.dev: lazy-load below the fold, and only the LCP
 * image gets fetchpriority=high.
 */
export function lcpAboveBody(post: { kind?: string | null; coverImage?: string | null }): boolean {
  return post.kind === "episode" || Boolean(post.coverImage);
}

/** Markdown to the HTML the site stores. Throws Prelum's ContentError (with the line and the fix) on a source it refuses. */
export async function renderMarkdown(
  body: string,
  lookup: MediaLookup,
  {
    lcpAbove = false,
    env,
    diagrams,
  }: { lcpAbove?: boolean; env?: Env; diagrams?: DiagramFiles } = {},
): Promise<Rendered> {
  const { render } = await import("@drdustinedwards/site-helpers/render/nomath");
  const keys = [
    ...new Set(
      [...body.matchAll(IMAGE_URL)]
        .map(([url]) => imageKeyOf(url))
        .filter((k): k is string => k !== null),
    ),
  ];
  const rows = new Map((await lookup(keys)).map((row) => [row.key, row]));
  const wide = wideSources(body);
  const attributesOf = (src: string) => {
    const key = imageKeyOf(src);
    const row = key ? rows.get(key) : undefined;
    if (!row) return null;
    const use: ImageUseName = wide.has(src) ? "leadFigure" : "figure";
    return images.attributes(
      {
        src: mediaPath(row.key),
        width: row.width,
        height: row.height,
        focus: row.focus,
        version: row.sha256,
      },
      use,
    );
  };
  const out = await render({
    file: "body.md",
    body,
    async resolveImage(src) {
      const attrs = attributesOf(src);
      // No placeholder to Prelum yet: it writes one as a bare background-image (img.has-lqip), which needs Capsomer's
      // picture.css (0.57) to size it, and this site does not load that stylesheet.
      return attrs?.width && attrs.height ? { width: attrs.width, height: attrs.height } : null;
    },
    options: {
      assertSafe: true,
      // :::diagram names its Mermaid by hash. The inline drawing replaces that image below.
      // editorialPack is not used: it also loads enarratio/plot for :::chart, which this site does not ship.
      packs: [diagramPack()],
      priority: { taken: lcpAbove },
      media: {
        keyOf: imageKeyOf,
        imageProps(src) {
          const attrs = attributesOf(src);
          if (!attrs?.srcset) return null;
          // The link around a picture opens the original at /media, versioned like its sizes so it is never a stale
          // copy (the lightbox shows it instead when script runs).
          const row = rows.get(imageKeyOf(src) ?? "");
          const href = row ? images.url(mediaPath(row.key), { version: row.sha256 }) : src;
          return {
            srcSet: attrs.srcset,
            sizes: attrs.sizes,
            href,
            sources: attrs.sources.map((s) => ({ type: s.type, srcSet: s.srcset })),
          };
        },
      },
    },
  });
  const files = diagrams ?? (env ? await loadBlogDiagrams(env) : new Map());
  return {
    html: inlineBlogDiagrams(String(out.html), files),
    meta: { toc: out.toc, faq: out.faq },
    renderVersion: out.renderVersion,
    readingMinutes: out.readingMinutes,
  };
}

/** What a save writes for a post body: the Markdown, its render and the reading time. */
export async function postBodyFields(env: Env, body: string, lcpAbove: boolean) {
  const r = await renderMarkdown(body, libraryMedia(env), { lcpAbove, env });
  return {
    body,
    bodyHtml: r.html,
    bodyMeta: r.meta,
    renderVersion: r.renderVersion,
    readingTime: r.readingMinutes,
  } satisfies Partial<Post>;
}

/** What a save writes for a page: the Markdown and its render. */
export async function pageFields(env: Env, value: string) {
  const r = await renderMarkdown(value, libraryMedia(env), { env });
  return { value, bodyHtml: r.html, renderVersion: r.renderVersion };
}

type Stored = {
  body: string;
  bodyHtml: string | null;
  bodyMeta?: BodyMeta | null;
  renderVersion: string | null;
  kind?: string | null;
  coverImage?: string | null;
};

/**
 * The HTML a public read shows, through Prelum's storedRender (`./stored-render`): a stored render at Prelum's version
 * is used as it is, except its diagrams (`current`: a Mermaid figure this site now draws inline, or a drawing inlined at
 * an earlier render, is drawn from the site's current file in memory and its caption stays), so the page is current
 * before the row is saved again. A render older than Prelum's is rendered in memory, and the every-minute cron stores
 * it. A body that no longer renders keeps its last stored HTML, so a page never fails on its own text. The HTML is
 * wrapped in the version it was rendered at, which prelum-content reads to see a page left behind.
 */
export async function storedBody(env: Env, row: Stored): Promise<{ html: string; meta: BodyMeta }> {
  if (row.renderVersion === null) return { html: inDiagramContext(row.body), meta: EMPTY_META };
  let failed = false;
  const shown = await storedRender(
    {
      body: row.body,
      html: row.bodyHtml,
      version: row.renderVersion,
      meta: row.bodyMeta ?? EMPTY_META,
    },
    {
      render: () => renderMarkdown(row.body, libraryMedia(env), { lcpAbove: lcpAboveBody(row), env }),
      current: async (html) =>
        drawsDiagrams(html)
          ? inlineBlogDiagrams(html, await loadBlogDiagrams(env))
          : inDiagramContext(html),
      onError: (err) => {
        failed = true;
        logEvent("render.failed", { error: errorText(err) }, { level: "error" });
      },
    },
  );
  return { html: failed ? inDiagramContext(shown.html) : shown.html, meta: shown.meta };
}

/** The page's table of contents: the body's h2s, shown one level down as the page demotes them (BodyRenderer). */
export function pageToc(meta: BodyMeta): Array<{ level: 2 | 3; id: string; text: string }> {
  return meta.toc.filter((t) => t.depth === 2).map((t) => ({ level: 3, id: t.id, text: t.text }));
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));

type PostRow = { id: number; body: string; kind: string | null; coverImage: string | null };
type PageRow = { key: string; value: string };

/**
 * Renders the posts and pages again and saves each, one at a time, through Prelum's rerenderEach: a row that no longer
 * renders goes to `onError` and is left as it is, and never stops the rest. The updated_at stays: nothing a writer did
 * changed.
 */
async function rerenderRows(
  env: Env,
  postRows: PostRow[],
  pageRows: PageRow[],
  onError: (what: string, err: unknown) => void,
): Promise<{ done: number; failed: number }> {
  const db = getDb(env);
  const lookup = libraryMedia(env);
  const p = await rerenderEach(postRows, {
    render: (row) => renderMarkdown(row.body, lookup, { lcpAbove: lcpAboveBody(row), env }),
    save: (row, r) =>
      db
        .update(posts)
        .set({
          bodyHtml: r.html,
          bodyMeta: r.meta,
          renderVersion: r.renderVersion,
          readingTime: r.readingMinutes,
        })
        .where(eq(posts.id, row.id)),
    onError: (row, err) => onError(`post ${row.id}`, err),
  });
  const b = await rerenderEach(pageRows, {
    render: (row) => renderMarkdown(row.value, lookup, { env }),
    save: (row, r) =>
      db
        .update(contentBlocks)
        .set({ bodyHtml: r.html, renderVersion: r.renderVersion })
        .where(eq(contentBlocks.key, row.key)),
    onError: (row, err) => onError(row.key, err),
  });
  return { done: p.done + b.done, failed: p.failed + b.failed };
}

const postColumns = { id: posts.id, body: posts.body, kind: posts.kind, coverImage: posts.coverImage };
const pageColumns = { key: contentBlocks.key, value: contentBlocks.value };

/**
 * Re-renders the converted posts and pages whose Markdown names a library file, after its bytes change (a replace,
 * turn, revert or shrink). Their stored HTML carries the file's version in its size URLs (`v=`), so the re-render is
 * what moves them to the new picture; without it a browser keeps the old one for the year the URL is cached.
 * Returns how many rows it re-rendered; a row that no longer renders is logged and left as it is.
 */
export async function rerenderUsing(env: Env, key: string): Promise<number> {
  const db = getDb(env);
  const pattern = `%${key.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const names = (col: typeof posts.body | typeof contentBlocks.value) =>
    sql`${like(col, pattern)} ESCAPE '\\'`;
  const [postRows, pageRows] = await Promise.all([
    db
      .select(postColumns)
      .from(posts)
      .where(and(isNotNull(posts.renderVersion), names(posts.body))),
    db
      .select(pageColumns)
      .from(contentBlocks)
      .where(
        and(
          eq(contentBlocks.kind, "page"),
          isNotNull(contentBlocks.renderVersion),
          names(contentBlocks.value),
        ),
      ),
  ]);
  const { done } = await rerenderRows(env, postRows, pageRows, (what, err) =>
    logEvent("render.media-failed", { what, key, error: errorText(err) }, { level: "error" }),
  );
  return done;
}

/** Re-renders every converted post and page whose render is older than Prelum's, from the every-minute cron. */
export async function rerenderStale(
  env: Env,
): Promise<{ posts: number; pages: number; failed: number }> {
  const db = getDb(env);
  const stale = (col: typeof posts.renderVersion | typeof contentBlocks.renderVersion) =>
    and(isNotNull(col), ne(col, RENDER_VERSION));
  const [postRows, pageRows] = await Promise.all([
    db.select(postColumns).from(posts).where(stale(posts.renderVersion)),
    db
      .select(pageColumns)
      .from(contentBlocks)
      .where(and(eq(contentBlocks.kind, "page"), stale(contentBlocks.renderVersion))),
  ]);
  const { failed } = await rerenderRows(env, postRows, pageRows, (what, err) =>
    logEvent("render.stale-failed", { what, error: errorText(err) }, { level: "error" }),
  );
  return { posts: postRows.length, pages: pageRows.length, failed };
}
