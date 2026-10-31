// The media library's rows in D1 (drizzle/0015_media_library.sql): one `media` row per image in BLOG_IMAGES, its byte
// history and the change log the triggers write. The R2 object is the bytes and the public address; everything else a
// file carries is here. Every write that moves a file's version goes through writeAtRev, which checks and bumps `rev`
// in one statement, so a stale write is refused rather than lost and two writes in one second still differ.
import { and, desc, eq, gt, inArray, lte, max, or, sql } from "drizzle-orm";
import type { PreparedUpload } from "@dustinedwards/site-api";
import { getDb } from "~/db/index.server";
import { media, mediaChanges, mediaRevisions, type MediaRevisionRow, type MediaRow } from "~/db/schema";

export type { MediaRevisionRow, MediaRow };
export type MediaFields = Partial<Omit<MediaRow, "key" | "rev" | "updatedAt">>;

export async function mediaRow(env: Env, key: string): Promise<MediaRow | null> {
  const rows = await getDb(env).select().from(media).where(eq(media.key, key)).limit(1);
  return rows[0] ?? null;
}

export async function mediaRows(env: Env, keys: string[]): Promise<MediaRow[]> {
  if (keys.length === 0) return [];
  return getDb(env).select().from(media).where(inArray(media.key, keys));
}

/** Every row, trashed or not. The library is small enough to filter, count and sort in the Worker. */
export async function allMediaRows(env: Env): Promise<MediaRow[]> {
  return getDb(env).select().from(media);
}

export async function insertMediaRow(env: Env, row: typeof media.$inferInsert, { ifAbsent = false } = {}): Promise<boolean> {
  const insert = getDb(env).insert(media).values(row);
  const written = await (ifAbsent ? insert.onConflictDoNothing() : insert).returning({ key: media.key });
  return written.length > 0;
}

/** The width and height an upload records on its object, where every page sizes the image by (images.server.ts). */
export const sizeMetadata = (file: PreparedUpload): Record<string, string> =>
  file.width && file.height ? { width: String(file.width), height: String(file.height) } : {};

/**
 * The row for an upload just stored in BLOG_IMAGES (Carrel's media group, and the admin editor's app/routes/admin.upload.ts),
 * its caption, credit, license and date from what the picture says about itself.
 */
export async function recordUpload(
  env: Env,
  key: string,
  file: PreparedUpload,
  { alt = "", sourceUrl = null, uploadedAt = new Date().toISOString() }: { alt?: string; sourceUrl?: string | null; uploadedAt?: string } = {},
): Promise<void> {
  const { caption = "", credit = "", license = "", takenAt = null } = file.embedded;
  await insertMediaRow(env, {
    key,
    filename: file.filename,
    contentType: file.contentType,
    bytes: file.bytes.byteLength,
    width: file.width,
    height: file.height,
    caption,
    credit,
    license,
    takenAt,
    alt,
    sourceUrl,
    sha256: file.sha256,
    placeholder: file.placeholder,
    color: file.color,
    uploadedAt,
  });
}

export type RevWrite = { ok: true; rev: number } | { ok: false; reason: "missing" } | { ok: false; reason: "stale"; rev: number };

/**
 * Writes `fields` and moves the version, only if the row is still at `expectedRev` (null: whatever it holds). The check
 * and the write are one statement; when nothing was written the row is read again to say why.
 */
export async function writeAtRev(env: Env, key: string, fields: MediaFields, expectedRev: number | null): Promise<RevWrite> {
  const written = await getDb(env)
    .update(media)
    .set({ ...fields, rev: sql`${media.rev} + 1`, updatedAt: sql`(datetime('now'))` })
    .where(expectedRev === null ? eq(media.key, key) : and(eq(media.key, key), eq(media.rev, expectedRev)))
    .returning({ rev: media.rev });
  if (written[0]) return { ok: true, rev: written[0].rev };
  const now = await mediaRow(env, key);
  return now ? { ok: false, reason: "stale", rev: now.rev } : { ok: false, reason: "missing" };
}

/** The columns that follow the bytes after a write has claimed the version (writeAtRev), without moving it again. */
export async function followMedia(env: Env, key: string, fields: MediaFields): Promise<void> {
  await getDb(env)
    .update(media)
    .set({ ...fields, updatedAt: sql`(datetime('now'))` })
    .where(eq(media.key, key));
}

export async function deleteMediaRow(env: Env, key: string): Promise<boolean> {
  const gone = await getDb(env).delete(media).where(eq(media.key, key)).returning({ key: media.key });
  return gone.length > 0;
}

/**
 * The file holding these bytes: one whose current bytes match, else one whose original upload did (a large picture is
 * shrunk at upload, and the same original sent again is still the same file).
 */
export async function mediaByHash(env: Env, sha256: string): Promise<MediaRow | null> {
  const db = getDb(env);
  const [current] = await db.select().from(media).where(eq(media.sha256, sha256)).orderBy(media.uploadedAt).limit(1);
  if (current) return current;
  const [original] = await db
    .select({ row: media })
    .from(mediaRevisions)
    .innerJoin(media, eq(media.key, mediaRevisions.mediaKey))
    .where(and(eq(mediaRevisions.sha256, sha256), or(eq(mediaRevisions.reason, "upload"), eq(mediaRevisions.reason, "import"))))
    .limit(1);
  return original?.row ?? null;
}

/** Other files whose current bytes are exactly this hash's. */
export async function mediaTwins(env: Env, sha256: string | null, key: string): Promise<MediaRow[]> {
  if (!sha256) return [];
  const rows = await getDb(env).select().from(media).where(eq(media.sha256, sha256)).limit(51);
  return rows.filter((r) => r.key !== key);
}

// ---------- the change log

/** The newest change's number, or 0 before any: where a poll that starts now begins. */
export async function mediaChangeCursor(env: Env): Promise<number> {
  const [row] = await getDb(env).select({ seq: max(mediaChanges.seq) }).from(mediaChanges);
  return row?.seq ?? 0;
}

/** Each file changed after `from` and up to `head`, once, at its latest change, oldest first; at most limit + 1. */
export async function mediaChangedSince(env: Env, from: number, head: number, limit: number): Promise<Array<{ key: string; seq: number }>> {
  const latest = max(mediaChanges.seq);
  const rows = await getDb(env)
    .select({ key: mediaChanges.mediaKey, seq: latest })
    .from(mediaChanges)
    .where(and(gt(mediaChanges.seq, from), lte(mediaChanges.seq, head)))
    .groupBy(mediaChanges.mediaKey)
    .orderBy(latest)
    .limit(limit + 1);
  return rows.map((r) => ({ key: r.key, seq: r.seq ?? 0 }));
}

// ---------- the byte history

export async function addMediaRevision(env: Env, row: Omit<MediaRevisionRow, "id" | "backupKey"> & { backupKey?: string | null }): Promise<number> {
  const [made] = await getDb(env).insert(mediaRevisions).values(row).returning({ id: mediaRevisions.id });
  return made!.id;
}

/** A file's revisions, newest first. */
export async function mediaRevisionsOf(env: Env, key: string, limit = 100): Promise<MediaRevisionRow[]> {
  return getDb(env)
    .select()
    .from(mediaRevisions)
    .where(eq(mediaRevisions.mediaKey, key))
    .orderBy(desc(mediaRevisions.id))
    .limit(limit);
}

/** Records where a revision's bytes were kept once newer ones replace them. */
export async function keepMediaRevision(env: Env, id: number, backupKey: string): Promise<void> {
  await getDb(env).update(mediaRevisions).set({ backupKey }).where(eq(mediaRevisions.id, id));
}
