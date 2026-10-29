// The site's side of Carrel's contract (@dustinedwards/site-api): an adapter over the
// articles in D1 and the images in the BLOG_IMAGES bucket, using the same save and publish
// invariants as the admin editor (sanitize on every write, a snapshot before every edit, a guid
// generated once at first publish and never rewritten).
//
// SCOPE. Articles only. Podcast episodes carry audio, peaks, chapters and people that a markdown
// source cannot represent, so they are not exposed (kind "episode" is never listed or writable).
//
// IDS AND VERSIONS. A content id is the article's slug. A version is a hash of everything Carrel can
// see or change (the source, the status and the schedule, and an update waiting on a live article),
// so any change anywhere gives a new version and two saves in one second cannot collide.
//
// SCHEDULES. An article scheduled before it was ever live is a published row with a future
// publish_at: every public read hides it until then (publiclyVisible), so it needs no cron. An
// update scheduled on a LIVE article (site-api v0.10.0) waits in scheduled_updates while the live
// version stays served, and the one-minute cron (workers/app.ts, api.runSchedules) puts it live.
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import {
  contentVersion,
  MediaInUseError,
  NotFoundError,
  RefusedError,
  VersionConflictError,
  type ContentSummary,
  type MediaItem,
  type ScheduledUpdate,
  type SiteAdapter,
  type WriteResult,
} from "@dustinedwards/site-api";
import { d1ScheduledUpdates, utc } from "@dustinedwards/site-api/schedules";
import { replaceObject, writeFocus, type R2BucketLike } from "@dustinedwards/site-api/r2";
import { FOCUS_METADATA, focusOf } from "@dustinedwards/site-runtime/image";
import { getDb } from "~/db/index.server";
import { mediaCaptions, posts, postVersions, type Post } from "~/db/schema";
import { generateGuid, snapshotVersion, updatePost } from "~/lib/admin.server";
import { buildKey, imageUrl } from "~/lib/r2.server";
import { imageMetadata } from "~/lib/images.server";
import { SITE_ORIGIN } from "~/lib/site";
import { sanitizeHtml } from "~/lib/sanitize.server";
import { addHeadingIds, demoteHeadings, readingTime } from "~/lib/seo";
import { parseSource, renderSource } from "./source";

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

type Waiting = Pick<ScheduledUpdate, "publishAt" | "changeId"> | null;

/**
 * The version of a row as Carrel sees it. The waiting update's time and change id join the parts
 * only when there is one, so every version made before scheduled updates existed is unchanged.
 */
const versionOf = (p: Post, update: Waiting = null): Promise<string> =>
  contentVersion([renderSource(p), p.status, p.publishAt ?? null, ...(update ? [update.publishAt, update.changeId] : [])]);

const waitingOf = (u: ScheduledUpdate | null): Waiting => (u ? { publishAt: u.publishAt, changeId: u.changeId } : null);

function summaryOf(p: Post, update: Waiting = null): ContentSummary {
  return {
    scheduledUpdate: update,
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
async function requireVersion(post: Post | null, update: Waiting, expected: string | null): Promise<void> {
  const current = post ? await versionOf(post, update) : null;
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
  const updates = d1ScheduledUpdates(env.DB);
  const waiting = async (slug: string): Promise<Waiting> => waitingOf(await updates.get(slug));

  // Carrel's changeId joins its authorship record to this site's history. posts has no column for
  // it, so it is written to the Worker log with the id and the new version, and returned to Carrel.
  const recordChange = (event: string, id: string, version: string, changeId: string) =>
    log({ event: `carrel.${event}`, id, version, changeId });

  // `dropUpdate`: a publish or an unpublish drops an update waiting on the article, so the cron
  // never brings back what was just published over or taken down.
  async function write(
    event: string,
    slug: string,
    changeId: string,
    expectedVersion: string | null,
    build: (current: Post | null) => Promise<Partial<Post>>,
    { dropUpdate = false } = {},
  ): Promise<WriteResult> {
    const current = await findArticle(env, slug);
    const update = current ? await waiting(slug) : null;
    await requireVersion(current, update, expectedVersion);
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
    if (update && dropUpdate) await updates.remove(slug).run();
    const left = dropUpdate ? null : update;
    const version = await versionOf((await findArticle(env, slug)) ?? row, left);
    recordChange(event, slug, version, changeId);
    return { id: slug, version, status: statusOf(row), changeId, scheduledUpdate: left };
  }

  return {
    site: { id: "germomics", name: "Germomics", origin: SITE_ORIGIN },

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
        const waits = await Promise.all(page.map((p) => waiting(p.slug)));
        return { items: page.map((p, i) => summaryOf(p, waits[i])), nextCursor: next };
      },

      async get(id) {
        const p = await findArticle(env, id);
        if (!p) return null;
        const update = await waiting(id);
        return { ...summaryOf(p, update), format: "markdown" as const, source: renderSource(p), version: await versionOf(p, update) };
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
        }, { dropUpdate: true }),

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
        }, { dropUpdate: true }),

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
        if ((await versionOf(p, await waiting(id))) === version) return renderSource(p);
        const rows = await db.select().from(postVersions).where(eq(postVersions.postId, p.id)).limit(50);
        for (const r of rows) {
          const snap = r.snapshot as Post;
          if ((await versionOf(snap)) === version) return renderSource(snap);
        }
        return null;
      },
    },

    // Updates scheduled on live articles (site-api v0.10.0), kept in scheduled_updates.
    schedules: {
      async get(id) {
        return (await findArticle(env, id)) ? updates.get(id) : null;
      },

      async update(id, { source, publishAt, expectedVersion, changeId }) {
        const current = await findArticle(env, id);
        if (!current) throw new NotFoundError();
        const before = await waiting(id);
        await requireVersion(current, before, expectedVersion);
        if (statusOf(current) !== "published") throw new RefusedError("Only a live article takes a scheduled update.");
        await fieldsFromSource(source); // refused now, not at the time, when it cannot be read
        await updates.put(id, { source, publishAt, changeId }).run();
        const update = { publishAt: utc(publishAt), changeId };
        const version = await versionOf(current, update);
        recordChange("schedule.update", id, version, changeId);
        return { id, version, status: "published", changeId, scheduledUpdate: update };
      },

      async cancel(id, { expectedVersion, changeId }) {
        const current = await findArticle(env, id);
        if (!current) throw new NotFoundError();
        const update = await waiting(id);
        await requireVersion(current, update, expectedVersion);
        if (update) {
          await updates.remove(id).run();
          const version = await versionOf(current, null);
          recordChange("schedule.cancel", id, version, changeId);
          return { id, version, status: statusOf(current), changeId, scheduledUpdate: null };
        }
        if (statusOf(current) !== "scheduled") throw new RefusedError("Nothing is scheduled for this article.");
        // Never live: back to a draft, as an unpublish would.
        return write("schedule.cancel", id, changeId, expectedVersion, async () => ({ status: "draft", publishAt: null }));
      },

      // Only waiting updates: a never-live scheduled article goes live by its publish_at on every read.
      due: ({ now, limit }) => updates.due(now, limit),

      async apply(id, { kind, publishAt, changeId, now }) {
        if (kind !== "update" || new Date(publishAt) > now) return null;
        const update = await updates.get(id);
        if (!update || update.publishAt !== utc(publishAt) || update.changeId !== changeId) return null;
        const match = { publishAt: update.publishAt, changeId };
        const current = await findArticle(env, id);
        // Deleted, renamed or taken down in the admin editor since: the update has nothing left to replace.
        if (!current || statusOf(current) !== "published") {
          await updates.remove(id, match).run();
          return null;
        }
        const fields = await fieldsFromSource(update.source);
        await snapshotVersion(env, current);
        await updatePost(env, current.id, fields);
        await updates.remove(id, match).run();
        const row = (await findArticle(env, id)) ?? { ...current, ...fields };
        const version = await versionOf(row, null);
        recordChange("schedule.apply", id, version, changeId);
        return { id, version, status: "published", changeId, scheduledUpdate: null };
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
        const captions = await captionsOf(env, page.map((o) => o.key));
        const items = await Promise.all(page.map((o) => toMediaItem(o, captions.get(o.key) ?? "")));
        // A cursor only when the bucket has more; items past `limit` in this batch are listed next time
        // because the cursor is the bucket's own and the next call starts after the whole batch.
        return { items, nextCursor: listed.truncated ? listed.cursor ?? null : null };
      },

      async get(id) {
        const head = await env.BLOG_IMAGES.head(id);
        if (!head) return null;
        const captions = await captionsOf(env, [id]);
        return { ...(await toMediaItem(head, captions.get(id) ?? "")), usedBy: await usesOf(env, id) };
      },

      async upload({ bytes, contentType, filename, alt, changeId }) {
        const key = buildKey("carrel", filename);
        const size = await imageMetadata(env, bytes);
        const put = await env.BLOG_IMAGES.put(key, bytes, {
          httpMetadata: { contentType },
          customMetadata: { alt, filename, changeId, ...size },
        });
        recordChange("media.upload", key, put.etag, changeId);
        return toMediaItem(put, "");
      },

      // Focal point, caption and replace (site-api v0.10.0), each moving the file's version (mediaVersion).
      async setFocus(id, { focus, expectedVersion, changeId }) {
        const { caption } = await requireMediaVersion(env, id, expectedVersion);
        const written = await writeFocus(env.BLOG_IMAGES as unknown as R2BucketLike, id, focus);
        const version = await mediaVersion(written as { etag: string; customMetadata?: Record<string, string> }, caption);
        recordChange("media.focus", id, version, changeId);
        return { version };
      },

      async setCaption(id, { caption, expectedVersion, changeId }) {
        const { head } = await requireMediaVersion(env, id, expectedVersion);
        if (caption) {
          await db
            .insert(mediaCaptions)
            .values({ mediaKey: id, caption })
            .onConflictDoUpdate({ target: mediaCaptions.mediaKey, set: { caption, updatedAt: sql`(datetime('now'))` } });
        } else {
          await db.delete(mediaCaptions).where(eq(mediaCaptions.mediaKey, id));
        }
        const version = await mediaVersion(head, caption);
        recordChange("media.caption", id, version, changeId);
        return { version };
      },

      // The same key and address with new bytes: alt, caption and filename kept, the focal point
      // cleared (replaceObject), and the width and height measured again. /media keys its cached sizes
      // by the object's etag (site-runtime 0.27), so no old size is served again.
      async replace(id, { bytes, contentType, expectedVersion, changeId }) {
        const { caption } = await requireMediaVersion(env, id, expectedVersion);
        const object = await replaceObject(env.BLOG_IMAGES as unknown as R2BucketLike, id, { bytes, contentType });
        const size = await imageMetadata(env, bytes);
        const { width: _w, height: _h, ...kept } = object.customMetadata ?? {};
        if (object.customMetadata?.width !== size.width || object.customMetadata?.height !== size.height) {
          const remeasured = await env.BLOG_IMAGES.put(id, bytes, {
            httpMetadata: object.httpMetadata as R2HTTPMetadata,
            customMetadata: { ...kept, ...size },
            onlyIf: { etagMatches: object.etag },
          });
          if (!remeasured) throw new RefusedError("The file changed on the site while this was being written. Try again.");
        }
        const head = await env.BLOG_IMAGES.head(id);
        if (!head) throw new NotFoundError();
        const item = await toMediaItem(head, caption);
        recordChange("media.replace", id, item.version!, changeId);
        return { item, sizesNeedPurge: false };
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

/**
 * A file's version: its bytes (the object's etag, an MD5 that a metadata-only put leaves alone), the
 * metadata Carrel edits (alt and focal point) and its caption, which lives in D1.
 */
const mediaVersion = (object: { etag: string; customMetadata?: Record<string, string> }, caption: string): Promise<string> =>
  contentVersion([object.etag, object.customMetadata?.alt ?? "", focusOf(object.customMetadata?.[FOCUS_METADATA]), caption]);

async function toMediaItem(object: R2Object, caption: string): Promise<MediaItem> {
  const meta = object.customMetadata;
  return {
    id: object.key,
    url: imageUrl(object.key),
    filename: meta?.filename ?? object.key.split("/").pop() ?? null,
    contentType: object.httpMetadata?.contentType ?? "application/octet-stream",
    bytes: object.size,
    width: Number(meta?.width) || null,
    height: Number(meta?.height) || null,
    alt: meta?.alt ?? "",
    uploadedAt: object.uploaded ? object.uploaded.toISOString() : null,
    deletable: true,
    version: await mediaVersion(object, caption),
    focus: focusOf(meta?.[FOCUS_METADATA]),
    caption,
  };
}

async function captionsOf(env: Env, keys: string[]): Promise<Map<string, string>> {
  if (keys.length === 0) return new Map();
  const rows = await getDb(env).select().from(mediaCaptions).where(inArray(mediaCaptions.mediaKey, keys));
  return new Map(rows.map((r) => [r.mediaKey, r.caption]));
}

/** Every media write checks the file's version first: a missing file is NotFound, a stale version a conflict. */
async function requireMediaVersion(env: Env, id: string, expected: string): Promise<{ head: R2Object; caption: string }> {
  const head = await env.BLOG_IMAGES.head(id);
  if (!head) throw new NotFoundError("No such media.");
  const caption = (await captionsOf(env, [id])).get(id) ?? "";
  const current = await mediaVersion(head, caption);
  if (current !== expected) throw new VersionConflictError(current);
  return { head, caption };
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
