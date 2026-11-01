// The one render of the site's writing: a post body or a page, stored as Markdown, rendered to HTML by Prelum's
// pipeline (render/nomath: `$` is a price here, so no KaTeX) with assertSafe on. Every save path stores the result
// beside the Markdown (renderFields), a public read serves the stored HTML while its renderVersion is Prelum's
// (storedBody), and the nightly cron re-renders the rows an upgrade left behind (rerenderStale).
//
// IMAGES. A picture's size comes from the media library (D1 `media`), so the HTML carries its width and height, and
// its srcset and AVIF and WebP sources are /media copies (site-runtime ./image, app/lib/images.ts). A figure is shown
// at most 400px wide, the lead illustration (width=wide) at most 520px, as before. An image the library does not
// hold is written as it is, unsized.
//
// NOT CONVERTED YET. A row whose renderVersion is NULL predates the move (drizzle/0016): its body is still the
// sanitized HTML the TipTap editor saved, and it is served as it is until the conversion or a save gives it Markdown.
//
// Prelum is imported on first use, so the public routes that only read stored HTML never load the pipeline.
import type * as Prelum from "@drdustinedwards/site-helpers/render/nomath";
import { logEvent } from "@dustinedwards/site-runtime/log";
import { and, eq, inArray, isNotNull, like, ne, sql } from "drizzle-orm";
import { getDb } from "~/db/index.server";
import { contentBlocks, media, posts, type Post } from "~/db/schema";
import { imageKeyOf, images, mediaPath, type ImageUseName } from "~/lib/images";
import { IMAGE_ORIGIN } from "~/lib/site";
import type { BodyMeta } from "~/lib/types";

/** Prelum's RENDER_VERSION, kept here so a read can compare without loading the pipeline. */
export const RENDER_VERSION = "15";
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
          .select({ key: media.key, width: media.width, height: media.height, focus: media.focus, sha256: media.sha256 })
          .from(media)
          .where(inArray(media.key, keys));
}

const IMAGE_URL = new RegExp(`${IMAGE_ORIGIN.replace(/[.]/g, "\\.")}/[^\\s"'()<>\\]]+`, "g");
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

export type Rendered = { html: string; meta: BodyMeta; renderVersion: string; readingMinutes: number };

/** Markdown to the HTML the site stores. Throws Prelum's ContentError (with the line and the fix) on a source it refuses. */
export async function renderMarkdown(body: string, lookup: MediaLookup): Promise<Rendered> {
  const { render } = await import("@drdustinedwards/site-helpers/render/nomath");
  const keys = [...new Set([...body.matchAll(IMAGE_URL)].map(([url]) => imageKeyOf(url)).filter((k): k is string => k !== null))];
  const rows = new Map((await lookup(keys)).map((row) => [row.key, row]));
  const wide = wideSources(body);
  const attributesOf = (src: string) => {
    const key = imageKeyOf(src);
    const row = key ? rows.get(key) : undefined;
    if (!row) return null;
    const use: ImageUseName = wide.has(src) ? "leadFigure" : "figure";
    return images.attributes({ src: mediaPath(row.key), width: row.width, height: row.height, focus: row.focus, version: row.sha256 }, use);
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
      media: {
        keyOf: imageKeyOf,
        imageProps(src) {
          const attrs = attributesOf(src);
          if (!attrs?.srcset) return null;
          // The link around a picture opens the original, which the lightbox shows instead when script runs.
          return { srcSet: attrs.srcset, sizes: attrs.sizes, href: src, sources: attrs.sources.map((s) => ({ type: s.type, srcSet: s.srcset })) };
        },
      },
    },
  });
  return {
    html: String(out.html),
    meta: { toc: out.toc, faq: out.faq },
    renderVersion: out.renderVersion,
    readingMinutes: out.readingMinutes,
  };
}

/** What a save writes for a post body: the Markdown, its render and the reading time. */
export async function postBodyFields(env: Env, body: string) {
  const r = await renderMarkdown(body, libraryMedia(env));
  return { body, bodyHtml: r.html, bodyMeta: r.meta, renderVersion: r.renderVersion, readingTime: r.readingMinutes } satisfies Partial<Post>;
}

/** What a save writes for a page: the Markdown and its render. */
export async function pageFields(env: Env, value: string) {
  const r = await renderMarkdown(value, libraryMedia(env));
  return { value, bodyHtml: r.html, renderVersion: r.renderVersion };
}

type Stored = { body: string; bodyHtml: string | null; bodyMeta?: BodyMeta | null; renderVersion: string | null };

/**
 * The HTML a public read shows: the stored render while it is current, else a render in memory (the cron stores it
 * that night). A body that no longer renders keeps its last stored HTML, so a page never fails on its own text. The
 * HTML is wrapped in the version it was rendered at, which prelum-content reads to see a page left behind.
 */
export async function storedBody(env: Env, row: Stored): Promise<{ html: string; meta: BodyMeta }> {
  if (row.renderVersion === null) return { html: row.body, meta: EMPTY_META };
  const shown = (html: string, version: string, meta: BodyMeta) => ({ html: html && `<div data-render-version="${version}">${html}</div>`, meta });
  if (row.renderVersion === RENDER_VERSION && row.bodyHtml !== null) return shown(row.bodyHtml, RENDER_VERSION, row.bodyMeta ?? EMPTY_META);
  try {
    const r = await renderMarkdown(row.body, libraryMedia(env));
    return shown(r.html, r.renderVersion, r.meta);
  } catch (err) {
    console.error(JSON.stringify({ event: "render.failed", error: err instanceof Error ? err.message : String(err) }));
    return shown(row.bodyHtml ?? "", row.renderVersion, row.bodyMeta ?? EMPTY_META);
  }
}

/** The page's table of contents: the body's h2s, shown one level down as the page demotes them (BodyRenderer). */
export function pageToc(meta: BodyMeta): Array<{ level: 2 | 3; id: string; text: string }> {
  return meta.toc.filter((t) => t.depth === 2).map((t) => ({ level: 3, id: t.id, text: t.text }));
}

/**
 * Re-renders the converted posts and pages whose Markdown names a library file, after its bytes change (a replace,
 * turn, revert or shrink). Their stored HTML carries the file's version in its size URLs (`v=`), so the re-render is
 * what moves them to the new picture; without it a browser keeps the old one for the year the URL is cached.
 * Returns how many rows it re-rendered; a row that no longer renders is logged and left as it is.
 */
export async function rerenderUsing(env: Env, key: string): Promise<number> {
  const db = getDb(env);
  const lookup = libraryMedia(env);
  const pattern = `%${key.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const names = (col: typeof posts.body | typeof contentBlocks.value) => sql`${like(col, pattern)} ESCAPE '\\'`;
  const [postRows, pageRows] = await Promise.all([
    db.select({ id: posts.id, body: posts.body }).from(posts).where(and(isNotNull(posts.renderVersion), names(posts.body))),
    db.select({ key: contentBlocks.key, value: contentBlocks.value }).from(contentBlocks).where(and(eq(contentBlocks.kind, "page"), isNotNull(contentBlocks.renderVersion), names(contentBlocks.value))),
  ]);
  let done = 0;
  for (const p of postRows) {
    try {
      const r = await renderMarkdown(p.body, lookup);
      await db.update(posts).set({ bodyHtml: r.html, bodyMeta: r.meta, renderVersion: r.renderVersion, readingTime: r.readingMinutes }).where(eq(posts.id, p.id));
      done += 1;
    } catch (err) {
      logEvent("render.media-failed", { what: `post ${p.id}`, key, error: err instanceof Error ? err.message : String(err) }, { level: "error" });
    }
  }
  for (const b of pageRows) {
    try {
      const r = await renderMarkdown(b.value, lookup);
      await db.update(contentBlocks).set({ bodyHtml: r.html, renderVersion: r.renderVersion }).where(eq(contentBlocks.key, b.key));
      done += 1;
    } catch (err) {
      logEvent("render.media-failed", { what: b.key, key, error: err instanceof Error ? err.message : String(err) }, { level: "error" });
    }
  }
  return done;
}

/**
 * Re-renders every converted post and page whose render is older than Prelum's, from the nightly cron. Rows that
 * no longer render are logged and left as they are. The updated_at stays: nothing a writer did changed.
 */
export async function rerenderStale(env: Env): Promise<{ posts: number; pages: number; failed: number }> {
  const db = getDb(env);
  const lookup = libraryMedia(env);
  const stale = (col: typeof posts.renderVersion | typeof contentBlocks.renderVersion) => and(isNotNull(col), ne(col, RENDER_VERSION));
  const [postRows, pageRows] = await Promise.all([
    db.select({ id: posts.id, body: posts.body }).from(posts).where(stale(posts.renderVersion)),
    db.select({ key: contentBlocks.key, value: contentBlocks.value }).from(contentBlocks).where(and(eq(contentBlocks.kind, "page"), stale(contentBlocks.renderVersion))),
  ]);
  let failed = 0;
  const attempt = async (what: string, run: () => Promise<unknown>) => {
    try {
      await run();
    } catch (err) {
      failed += 1;
      console.error(JSON.stringify({ event: "render.stale-failed", what, error: err instanceof Error ? err.message : String(err) }));
    }
  };
  for (const p of postRows) {
    await attempt(`post ${p.id}`, async () => {
      const r = await renderMarkdown(p.body, lookup);
      await db.update(posts).set({ bodyHtml: r.html, bodyMeta: r.meta, renderVersion: r.renderVersion, readingTime: r.readingMinutes }).where(eq(posts.id, p.id));
    });
  }
  for (const b of pageRows) {
    await attempt(b.key, async () => {
      const r = await renderMarkdown(b.value, lookup);
      await db.update(contentBlocks).set({ bodyHtml: r.html, renderVersion: r.renderVersion }).where(eq(contentBlocks.key, b.key));
    });
  }
  return { posts: postRows.length, pages: pageRows.length, failed };
}
