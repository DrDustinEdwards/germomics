// The media library's rows in D1: site-api's standard tables (drizzle/0029_shared_media_store.sql), one `media` row per
// image in BLOG_IMAGES. Carrel's library reads and writes them through site-api's d1MediaStore
// (app/lib/carrel/media.server.ts); here are the pages' read and the rows the backfill and the admin editor's upload add.
import { inList } from "@dustinedwards/site-runtime/d1";
import type { PreparedUpload } from "@dustinedwards/site-api";
import { getDb } from "~/db/index.server";
import { media, type MediaRow } from "~/db/schema";

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
