// The site's side of Carrel's contract (@dustinedwards/site-api v0.2.0): an adapter over the
// articles in D1 and the images in the BLOG_IMAGES bucket, using the same save and publish
// invariants as the admin editor (sanitize on every write, a snapshot before every edit, a guid
// generated once at first publish and never rewritten).
//
// SCOPE. Articles only. Podcast episodes carry audio, peaks, chapters and people that a markdown
// source cannot represent, so they are not exposed (kind "episode" is never listed or writable).
//
// IDS AND VERSIONS. A content id is the article's slug. A version is a hash of everything Carrel can
// see or change (the source, the status and the schedule), so any change anywhere gives a new
// version and two saves in one second cannot collide.
import { and, desc, eq, like, or } from "drizzle-orm";
import {
  MediaInUseError,
  NotFoundError,
  RefusedError,
  VersionConflictError,
  type ContentSummary,
  type MediaItem,
  type SiteAdapter,
  type WriteResult,
} from "@dustinedwards/site-api";
import { getDb } from "~/db/index.server";
import { posts, postVersions, type Post } from "~/db/schema";
import { generateGuid, snapshotVersion, updatePost } from "~/lib/admin.server";
import { buildKey, imageUrl } from "~/lib/r2.server";
import { sanitizeHtml } from "~/lib/sanitize.server";
import { addHeadingIds, demoteHeadings, readingTime } from "~/lib/seo";
import { parseSource, renderSource } from "./source";

const ORIGIN = "https://germomics.com";
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"];

type Status = ContentSummary["status"];

// SQLite's datetime('now') is "YYYY-MM-DD HH:MM:SS" in UTC; the contract wants ISO with an offset.
const iso = (v: string | null | undefined): string | null => {
  if (!v) return null;
  const withT = v.includes("T") ? v : `${v.replace(" ", "T")}Z`;
  const d = new Date(withT);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

function statusOf(p: Pick<Post, "status" | "publishAt">): Status {
  if (p.status !== "published") return "draft";
  return p.publishAt && p.publishAt > new Date().toISOString() ? "scheduled" : "published";
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The version of a row as Carrel sees it. */
async function versionOf(p: Post): Promise<string> {
  const basis = JSON.stringify([renderSource(p), p.status, p.publishAt ?? null]);
  return (await sha256Hex(basis)).slice(0, 32);
}

function summaryOf(p: Post): ContentSummary {
  return {
    id: p.slug,
    kind: "article",
    title: p.title,
    status: statusOf(p),
    path: p.publishedAt ? `/${p.slug}` : null,
    publishAt: iso(p.publishAt),
    publishedAt: iso(p.publishedAt),
    updatedAt: iso(p.updatedAt),
  };
}

async function findArticle(env: Env, slug: string): Promise<Post | null> {
  const rows = await getDb(env)
    .select()
    .from(posts)
    .where(and(eq(posts.slug, slug), eq(posts.kind, "article")))
    .limit(1);
  return rows[0] ?? null;
}

/** Every write checks the version first, in one place. */
async function requireVersion(post: Post | null, expected: string | null): Promise<void> {
  const current = post ? await versionOf(post) : null;
  if (current !== expected) throw new VersionConflictError(current);
}

/** The editor's save rules applied to a Carrel source: sanitize, reading time, only fields it names. */
async function fieldsFromSource(source: string): Promise<Partial<Post>> {
  let parsed;
  try {
    parsed = parseSource(source);
  } catch (err) {
    throw new RefusedError(err instanceof Error ? err.message : "The source could not be read.");
  }
  const body = await sanitizeHtml(parsed.body);
  const fields: Partial<Post> = { body, readingTime: readingTime(body) };
  if (parsed.title !== null) fields.title = parsed.title.trim() || "Untitled";
  if (parsed.excerpt !== null) fields.excerpt = parsed.excerpt;
  if (parsed.tags !== null) fields.tags = parsed.tags;
  if (parsed.coverImage !== null) fields.coverImage = parsed.coverImage;
  if (parsed.coverAlt !== null) fields.coverAlt = parsed.coverAlt;
  if (parsed.seoTitle !== null) fields.seoTitle = parsed.seoTitle;
  if (parsed.seoDescription !== null) fields.seoDescription = parsed.seoDescription;
  return fields;
}

export function createCarrelAdapter(env: Env, log: (entry: Record<string, unknown>) => void = console.log): SiteAdapter {
  const db = getDb(env);

  // Carrel's changeId joins its authorship record to this site's history. posts has no column for
  // it, so it is written to the Worker log with the id and the new version, and returned to Carrel.
  const recordChange = (event: string, id: string, version: string, changeId: string) =>
    log({ event: `carrel.${event}`, id, version, changeId });

  async function write(
    event: string,
    slug: string,
    changeId: string,
    expectedVersion: string | null,
    build: (current: Post | null) => Promise<Partial<Post>>,
  ): Promise<WriteResult> {
    const current = await findArticle(env, slug);
    await requireVersion(current, expectedVersion);
    if (!current) {
      if (!ID_PATTERN.test(slug)) throw new RefusedError("That id cannot be used as a slug.");
      // The slug is unique across every kind; an episode already holds it.
      const taken = await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, slug)).limit(1);
      if (taken.length > 0) throw new RefusedError("That slug belongs to a podcast episode, which Carrel does not edit.");
    }
    const fields = await build(current);
    let row: Post;
    if (current) {
      await snapshotVersion(env, current);
      await updatePost(env, current.id, fields);
      row = { ...current, ...fields };
    } else {
      const created = await db
        .insert(posts)
        .values({ kind: "article", title: "Untitled", slug, status: "draft", ...fields })
        .returning();
      row = created[0];
    }
    const version = await versionOf((await findArticle(env, slug)) ?? row);
    recordChange(event, slug, version, changeId);
    return { id: slug, version, status: statusOf(row), changeId };
  }

  return {
    site: { id: "germomics", name: "Germomics", origin: ORIGIN },

    content: {
      async list({ status, q, cursor, limit }) {
        const rows = await db
          .select()
          .from(posts)
          .where(
            q
              ? and(eq(posts.kind, "article"), or(like(posts.title, `%${q}%`), like(posts.slug, `%${q}%`)))
              : eq(posts.kind, "article"),
          )
          .orderBy(desc(posts.updatedAt), desc(posts.id));
        const matching = rows.filter((p) => ID_PATTERN.test(p.slug) && (!status || statusOf(p) === status));
        const start = Math.max(0, Number(cursor) || 0);
        const page = matching.slice(start, start + limit);
        const next = start + limit < matching.length ? String(start + limit) : null;
        return { items: page.map(summaryOf), nextCursor: next };
      },

      async get(id) {
        const p = await findArticle(env, id);
        if (!p) return null;
        return { ...summaryOf(p), format: "markdown" as const, source: renderSource(p), version: await versionOf(p) };
      },

      saveDraft: (id, input) =>
        write("save", id, input.changeId, input.expectedVersion, (current) =>
          fieldsFromSource(input.source).then((f) => ({ ...f, ...(current ? {} : { status: "draft" as const }) })),
        ),

      // A first publish from Carrel's key is allowed (Carrel design decision 2). The guid is made
      // once here and never rewritten, exactly as the editor does.
      publish: (id, input) =>
        write("publish", id, input.changeId, input.expectedVersion, async (current) => {
          if (!current) throw new NotFoundError();
          return {
            ...(input.source !== undefined ? await fieldsFromSource(input.source) : {}),
            status: "published",
            guid: current.guid ?? generateGuid(),
            publishedAt: current.publishedAt ?? new Date().toISOString(),
            publishAt: null,
          };
        }),

      schedule: (id, input) =>
        write("schedule", id, input.changeId, input.expectedVersion, async (current) => {
          if (!current) throw new NotFoundError();
          return {
            ...(input.source !== undefined ? await fieldsFromSource(input.source) : {}),
            status: "published",
            guid: current.guid ?? generateGuid(),
            publishAt: input.publishAt,
            publishedAt: input.publishAt,
          };
        }),

      unpublish: (id, input) =>
        write("unpublish", id, input.changeId, input.expectedVersion, async (current) => {
          if (!current) throw new NotFoundError();
          return { status: "draft", publishAt: null };
        }),

      async revisions(id) {
        const p = await findArticle(env, id);
        if (!p) return null;
        const rows = await db
          .select()
          .from(postVersions)
          .where(eq(postVersions.postId, p.id))
          .orderBy(desc(postVersions.createdAt), desc(postVersions.id))
          .limit(50);
        const items = [];
        for (const r of rows) {
          const snap = r.snapshot as Post;
          items.push({
            version: await versionOf(snap),
            at: iso(r.createdAt) ?? new Date(0).toISOString(),
            author: "germomics",
            message: `Saved before an edit (${snap.title})`,
          });
        }
        return items;
      },

      async revisionSource(id, version) {
        const p = await findArticle(env, id);
        if (!p) return null;
        if ((await versionOf(p)) === version) return renderSource(p);
        const rows = await db.select().from(postVersions).where(eq(postVersions.postId, p.id)).limit(50);
        for (const r of rows) {
          const snap = r.snapshot as Post;
          if ((await versionOf(snap)) === version) return renderSource(snap);
        }
        return null;
      },
    },

    // The page as the site would show the article body: the same sanitizer and heading handling the
    // article route applies. It is a plain page around the body, not the full themed route, because
    // an unsaved source has no row for the route to load.
    preview: {
      async render({ source }) {
        const parsed = parseSource(source);
        const body = addHeadingIds(demoteHeadings(await sanitizeHtml(parsed.body)));
        const title = (parsed.title ?? "Untitled").replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
        return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head><body><article><h1>${title}</h1>${body}</article></body></html>`;
      },
    },

    media: {
      limits: { maxBytes: MAX_IMAGE_BYTES, types: IMAGE_TYPES },

      async list({ q, cursor, limit }) {
        // R2 leaves metadata off a list unless asked for it; without include every file reads as untyped.
        const listed = await env.BLOG_IMAGES.list({
          limit: Math.min(limit * 4, 1000),
          cursor: cursor || undefined,
          include: ["httpMetadata", "customMetadata"],
        });
        const matching = listed.objects.filter((o) => !q || o.key.toLowerCase().includes(q.toLowerCase()));
        const page = matching.slice(0, limit);
        const items = page.map((o) => toMediaItem(o.key, o.size, o.httpMetadata?.contentType, o.customMetadata, o.uploaded));
        // A cursor only when the bucket has more; items past `limit` in this batch are listed next time
        // because the cursor is the bucket's own and the next call starts after the whole batch.
        return { items, nextCursor: listed.truncated ? listed.cursor ?? null : null };
      },

      async get(id) {
        const head = await env.BLOG_IMAGES.head(id);
        if (!head) return null;
        return {
          ...toMediaItem(id, head.size, head.httpMetadata?.contentType, head.customMetadata, head.uploaded),
          usedBy: await usesOf(env, id),
        };
      },

      async upload({ bytes, contentType, filename, alt, changeId }) {
        const key = buildKey("carrel", filename);
        const put = await env.BLOG_IMAGES.put(key, bytes, {
          httpMetadata: { contentType },
          customMetadata: { alt, filename, changeId },
        });
        recordChange("media.upload", key, put.etag, changeId);
        return toMediaItem(key, put.size, contentType, { alt, filename }, put.uploaded);
      },

      async delete(id, { changeId }) {
        const head = await env.BLOG_IMAGES.head(id);
        if (!head) throw new NotFoundError();
        let uses;
        try {
          uses = await usesOf(env, id);
        } catch {
          // A delete the site could not check is never made.
          throw new RefusedError("The check for where this image is used could not run, so it was not deleted.");
        }
        if (uses.length > 0) throw new MediaInUseError(uses);
        await env.BLOG_IMAGES.delete(id);
        recordChange("media.delete", id, "deleted", changeId);
      },
    },
  };
}

function toMediaItem(
  key: string,
  size: number,
  contentType: string | undefined,
  meta: Record<string, string> | undefined,
  uploaded: Date | undefined,
): MediaItem {
  return {
    id: key,
    url: imageUrl(key),
    filename: meta?.filename ?? key.split("/").pop() ?? null,
    contentType: contentType ?? "application/octet-stream",
    bytes: size,
    width: null,
    height: null,
    alt: meta?.alt ?? "",
    uploadedAt: uploaded ? uploaded.toISOString() : null,
    deletable: true,
  };
}

/** Where a file is used: any post (article or episode) whose body or image fields name its key. */
async function usesOf(env: Env, key: string) {
  const needle = `%${key}%`;
  const rows = await getDb(env)
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      body: posts.body,
      coverImage: posts.coverImage,
      ogImage: posts.ogImage,
      episodeArtwork: posts.episodeArtwork,
    })
    .from(posts)
    .where(
      or(
        like(posts.body, needle),
        like(posts.coverImage, needle),
        like(posts.ogImage, needle),
        like(posts.episodeArtwork, needle),
      ),
    );
  const uses = [];
  for (const r of rows) {
    const where = [
      r.coverImage?.includes(key) ? "cover image" : null,
      r.ogImage?.includes(key) ? "social image" : null,
      r.episodeArtwork?.includes(key) ? "episode artwork" : null,
      r.body.includes(key) ? "body" : null,
    ].filter((w): w is string => w !== null);
    if (where.length === 0) continue; // a LIKE wildcard matched; the key is not really there
    uses.push({ type: "post", id: r.slug, title: r.title, detail: where.join(", ") });
  }
  return uses;
}
