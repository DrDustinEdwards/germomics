// The one render of the site's writing: Markdown to HTML by Prelum (render/nomath: `$` is a price here, so no KaTeX)
// with assertSafe on. Save paths store the result beside the Markdown (renderFields); a public read serves the stored
// HTML while its renderVersion is Prelum's (storedBody); the cron re-renders stale rows (rerenderStale).
// Picture sizes come from the media library (D1 `media`); an image the library lacks is written unsized.
// A NULL renderVersion row predates drizzle/0016 and is served as its saved HTML. Prelum loads on first use.
import type * as Prelum from "@drdustinedwards/site-helpers/render/nomath";
import { diagramPack } from "~/lib/diagram-pack";
import { keyOfAddress, keysAtAddresses } from "@dustinedwards/site-runtime/image";
import { logEvent } from "@dustinedwards/site-runtime/log";
import { and, eq, isNotNull, ne } from "drizzle-orm";
import { inList, likeContains } from "@dustinedwards/site-runtime/d1";
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
import { images, mediaPath, type ImageUseName } from "~/lib/images";
import { MEDIA_ADDRESS } from "~/lib/site";
import type { BodyMeta } from "~/lib/types";

/** Prelum's RENDER_VERSION, kept here so a read can compare without loading the pipeline. */
export const RENDER_VERSION = "27";
// A Prelum upgrade that moves its version fails the typecheck until this constant moves with it.
RENDER_VERSION satisfies typeof Prelum.RENDER_VERSION;

const EMPTY_META: BodyMeta = { toc: [] };

type MediaSize = {
  key: string;
  width: number | null;
  height: number | null;
  focus: string | null;
  /** The bytes' hash, the version a size URL carries (`v=`), so a replaced file is a new URL. */
  sha256: string | null;
};
export type MediaLookup = (keys: string[]) => Promise<MediaSize[]>;

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

/** Whether the page's largest picture sits above the body (episode cover art, a post's cover), so body images stay lazy. */
export function lcpAboveBody(post: { kind?: string | null; coverImage?: string | null }): boolean {
  return post.kind === "episode" || Boolean(post.coverImage);
}

/** Throws Prelum's ContentError on a source it refuses. */
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
  const keys = [...keysAtAddresses(body, MEDIA_ADDRESS)];
  const rows = new Map((await lookup(keys)).map((row) => [row.key, row]));
  const wide = wideSources(body);
  const attributesOf = (src: string) => {
    const key = keyOfAddress(src, MEDIA_ADDRESS);
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
        keyOf: (src) => keyOfAddress(src, MEDIA_ADDRESS),
        imageProps(src) {
          const attrs = attributesOf(src);
          if (!attrs?.srcset) return null;
          // The link around a picture opens the original at /media, versioned like its sizes so it is never a stale
          // copy (the lightbox shows it instead when script runs).
          const row = rows.get(keyOfAddress(src, MEDIA_ADDRESS) ?? "");
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
    meta: { toc: out.toc },
    renderVersion: out.renderVersion,
    readingMinutes: out.readingMinutes,
  };
}

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
 * The HTML a public read shows, through Prelum's storedRender: a stored render at Prelum's version is used as is except
 * its diagrams, which are redrawn in memory. An older render is rendered in memory (the cron stores it); a body that no
 * longer renders keeps its last stored HTML. The HTML is wrapped in its render version, which prelum-content reads.
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
      render: () =>
        renderMarkdown(row.body, libraryMedia(env), { lcpAbove: lcpAboveBody(row), env }),
      current: async (html) =>
        drawsDiagrams(html)
          ? inlineBlogDiagrams(html, await loadBlogDiagrams(env))
          : inDiagramContext(html),
      onError: (err) => {
        failed = true;
        logEvent("render.failed", { error: err }, { level: "error" });
      },
    },
  );
  return { html: failed ? inDiagramContext(shown.html) : shown.html, meta: shown.meta };
}

/** The page's table of contents: the body's h2s, shown one level down as the page demotes them (BodyRenderer). */
export function pageToc(meta: BodyMeta): Array<{ level: 2 | 3; id: string; text: string }> {
  return meta.toc.filter((t) => t.depth === 2).map((t) => ({ level: 3, id: t.id, text: t.text }));
}

type PostRow = { id: number; body: string; kind: string | null; coverImage: string | null };
type PageRow = { key: string; value: string };

/** Re-renders rows one at a time; one that no longer renders goes to `onError`, is left as it is and keeps its updated_at. */
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

const postColumns = {
  id: posts.id,
  body: posts.body,
  kind: posts.kind,
  coverImage: posts.coverImage,
};
const pageColumns = { key: contentBlocks.key, value: contentBlocks.value };

/**
 * Re-renders posts and pages whose Markdown names a library file whose bytes changed. Stored HTML carries the file's
 * version in its size URLs (`v=`); without this a browser keeps the old picture for the cached year. Returns the count.
 */
export async function rerenderUsing(env: Env, key: string): Promise<number> {
  const db = getDb(env);
  const names = (col: typeof posts.body | typeof contentBlocks.value) => likeContains(col, key);
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
    logEvent("render.media-failed", { what, key, error: err }, { level: "error" }),
  );
  return done;
}

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
    logEvent("render.stale-failed", { what, error: err }, { level: "error" }),
  );
  return { posts: postRows.length, pages: pageRows.length, failed };
}
