// The media library's rows in D1 (drizzle/0015_media_library.sql): one `media` row per image in BLOG_IMAGES, its byte
// history and the change log the triggers write. The R2 object is the bytes and the public address; everything else a
// file carries is here. `mediaStore` is site-api's MediaLibraryStore over these tables, which differ from the network's
// standard ones (MEDIA_LIBRARY_SQL): sha256 may be null, tags are drizzle's JSON mode, `updated_at` is set on every
// write, a revision's copy is `backup_key`, and keys stored before Carrel that are not a MediaId are not library files.
// It only maps columns; every rule is site-api's mediaLibrary (app/lib/carrel/media.server.ts).
import { and, desc, eq, gt, lte, max, or, sql } from "drizzle-orm";
import { inList } from "@dustinedwards/site-runtime/d1";
import {
  MediaId,
  type MediaLibraryStore,
  type MediaRecord,
  type MediaRecordFields,
  type PreparedUpload,
} from "@dustinedwards/site-api";
import { getDb } from "~/db/index.server";
import { media, mediaChanges, mediaRevisions, type MediaRow } from "~/db/schema";

/** A key the library lists: a MediaId. Older objects under other names keep their address but stay out of Carrel. */
const isLibraryKey = (key: string) => MediaId.safeParse(key).success;

/** D1's "YYYY-MM-DD HH:MM:SS" (UTC) or an ISO time, as an ISO time; anything else as it is. */
function iso(value: string): string {
  const at = Date.parse(value.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/, "$1T$2Z"));
  return Number.isNaN(at) ? value : new Date(at).toISOString();
}

function recordOf(row: MediaRow): MediaRecord {
  return {
    key: row.key,
    rev: row.rev,
    filename: row.filename,
    contentType: row.contentType,
    bytes: row.bytes,
    width: row.width,
    height: row.height,
    sha256: row.sha256,
    alt: row.alt,
    caption: row.caption,
    tags: row.tags,
    focus: row.focus,
    credit: row.credit,
    license: row.license,
    sourceUrl: row.sourceUrl,
    licenseExpires: row.licenseExpires,
    takenAt: row.takenAt,
    placeholder: row.placeholder,
    color: row.color,
    uploadedAt: iso(row.uploadedAt),
    trashedAt: row.trashedAt === null ? null : iso(row.trashedAt),
  };
}

const COLUMNS = [
  "filename",
  "contentType",
  "bytes",
  "width",
  "height",
  "sha256",
  "alt",
  "caption",
  "tags",
  "focus",
  "credit",
  "license",
  "sourceUrl",
  "licenseExpires",
  "takenAt",
  "placeholder",
  "color",
  "uploadedAt",
  "trashedAt",
] as const satisfies ReadonlyArray<keyof MediaRow & keyof MediaRecord>;

/** The columns a write sets; fields this table has no column for are dropped. */
function columnsOf(fields: MediaRecordFields): Partial<MediaRow> {
  const set: Record<string, unknown> = {};
  for (const column of COLUMNS) if (fields[column] !== undefined) set[column] = fields[column];
  return set as Partial<MediaRow>;
}

const library = (rows: MediaRow[]) => rows.filter((r) => isLibraryKey(r.key)).map(recordOf);

/** The library's store over this site's tables. */
export function mediaStore(env: Env): MediaLibraryStore {
  const db = getDb(env);
  const one = async (key: string) => {
    if (!isLibraryKey(key)) return null;
    const [row] = await db.select().from(media).where(eq(media.key, key)).limit(1);
    return row ? recordOf(row) : null;
  };

  return {
    record: one,

    records: async (keys) => (keys.length === 0 ? [] : library(await mediaRows(env, keys))),

    all: async () => library(await db.select().from(media)),

    async byHash(sha256) {
      const current = await db
        .select()
        .from(media)
        .where(eq(media.sha256, sha256))
        .orderBy(media.uploadedAt, media.key);
      const [first] = library(current);
      if (first) return first;
      const original = await db
        .select({ row: media })
        .from(mediaRevisions)
        .innerJoin(media, eq(media.key, mediaRevisions.mediaKey))
        .where(
          and(
            eq(mediaRevisions.sha256, sha256),
            or(eq(mediaRevisions.reason, "upload"), eq(mediaRevisions.reason, "import")),
          ),
        )
        .orderBy(mediaRevisions.id);
      return library(original.map((o) => o.row))[0] ?? null;
    },

    async insert(record) {
      await db.insert(media).values({
        ...columnsOf(record),
        key: record.key,
        contentType: record.contentType,
        uploadedAt: record.uploadedAt,
      });
    },

    async writeAtRev(key, fields, expectedRev) {
      const [row] = await db
        .update(media)
        .set({
          ...columnsOf(fields),
          rev: sql`${media.rev} + 1`,
          updatedAt: sql`(datetime('now'))`,
        })
        .where(and(eq(media.key, key), eq(media.rev, expectedRev)))
        .returning();
      if (row) return { ok: true, record: recordOf(row) };
      const now = await one(key);
      return now ? { ok: false, reason: "stale", rev: now.rev } : { ok: false, reason: "missing" };
    },

    async follow(key, fields) {
      const [row] = await db
        .update(media)
        .set({ ...columnsOf(fields), updatedAt: sql`(datetime('now'))` })
        .where(eq(media.key, key))
        .returning();
      if (!row) throw new Error(`${key} changed its bytes, but its row is gone`);
      return recordOf(row);
    },

    async addRevision(key, { copyKey, ...revision }) {
      const [made] = await db
        .insert(mediaRevisions)
        .values({ ...revision, mediaKey: key, backupKey: copyKey })
        .returning({ id: mediaRevisions.id });
      return made!.id;
    },

    async revisions(key, limit = 100) {
      const rows = await db
        .select()
        .from(mediaRevisions)
        .where(eq(mediaRevisions.mediaKey, key))
        .orderBy(desc(mediaRevisions.id))
        .limit(limit);
      return rows.map((r) => ({
        id: r.id,
        at: iso(r.at),
        bytes: r.bytes,
        width: r.width,
        height: r.height,
        reason: r.reason,
        sha256: r.sha256,
        copyKey: r.backupKey,
      }));
    },

    async keepCopy(revisionId, copyKey) {
      await db
        .update(mediaRevisions)
        .set({ backupKey: copyKey })
        .where(eq(mediaRevisions.id, revisionId));
    },

    // Only at the version the reference check saw. The copies in BACKUPS under media/revisions/ stay.
    async remove(key, rev) {
      const [gone] = await db.batch([
        db
          .delete(media)
          .where(and(eq(media.key, key), eq(media.rev, rev)))
          .returning({ key: media.key }),
        db
          .delete(mediaRevisions)
          .where(
            and(
              eq(mediaRevisions.mediaKey, key),
              sql`NOT EXISTS (SELECT 1 FROM media WHERE key = ${key})`,
            ),
          ),
      ]);
      if (gone.length > 0) return "removed";
      return (await db.select({ key: media.key }).from(media).where(eq(media.key, key)).limit(1))
        .length > 0
        ? "stale"
        : "missing";
    },

    async changeCursor() {
      const [row] = await db.select({ seq: max(mediaChanges.seq) }).from(mediaChanges);
      return row?.seq ?? 0;
    },

    // Every changed key is read before the limit, so one that is not a MediaId never takes a place on the page.
    async changedSince(from, head, limit) {
      const latest = max(mediaChanges.seq);
      const rows = await db
        .select({ key: mediaChanges.mediaKey, seq: latest })
        .from(mediaChanges)
        .where(and(gt(mediaChanges.seq, from), lte(mediaChanges.seq, head)))
        .groupBy(mediaChanges.mediaKey)
        .orderBy(latest);
      return rows
        .filter((r) => isLibraryKey(r.key))
        .slice(0, limit + 1)
        .map((r) => ({ key: r.key, seq: r.seq ?? 0 }));
    },
  };
}

// ---------- the backfill and the admin editor's upload

export async function mediaRows(env: Env, keys: string[]): Promise<MediaRow[]> {
  if (keys.length === 0) return [];
  return getDb(env).select().from(media).where(inList(media.key, keys));
}

export async function insertMediaRow(
  env: Env,
  row: typeof media.$inferInsert,
  { ifAbsent = false } = {},
): Promise<boolean> {
  const insert = getDb(env).insert(media).values(row);
  const written = await (ifAbsent ? insert.onConflictDoNothing() : insert).returning({
    key: media.key,
  });
  return written.length > 0;
}

/** The width and height an upload records on its object, where every page sizes the image by (images.server.ts). */
export const sizeMetadata = (file: PreparedUpload): Record<string, string> =>
  file.width && file.height ? { width: String(file.width), height: String(file.height) } : {};

/**
 * The row for an upload the admin editor stored in BLOG_IMAGES (app/routes/admin.upload.ts), its caption, credit,
 * license and date from what the picture says about itself. Carrel's uploads go through the library instead.
 */
export async function recordUpload(env: Env, key: string, file: PreparedUpload): Promise<void> {
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
    sha256: file.sha256,
    placeholder: file.placeholder,
    color: file.color,
    uploadedAt: new Date().toISOString(),
  });
}
