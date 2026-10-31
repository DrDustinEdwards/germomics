// A file's byte history (site-api v0.13, mediaHistory): every set of bytes an image has had, so a replace, a turn, a
// mirror or a shrink can be taken back. The current bytes are the object in BLOG_IMAGES, the one copy of an image; each
// earlier set is copied to BACKUPS under media/revisions/<time>/<key> before it is overwritten, and nothing deletes that
// copy (d1-dump prunes only backups/json/). A revert puts one named copy back as a new revision.
import { NotFoundError, RefusedError, placeholderAndColor, sha256Hex } from "@dustinedwards/site-api";
import { replaceObject, type R2BucketLike } from "@dustinedwards/site-api/r2";
import { FOCUS_METADATA } from "@dustinedwards/site-runtime/image";
import {
  addMediaRevision,
  followMedia,
  keepMediaRevision,
  mediaRevisionsOf,
  type MediaFields,
  type MediaRevisionRow,
  type MediaRow,
} from "./store.server";

export type RevisionReason = MediaRevisionRow["reason"];

const BACKUP_PREFIX = "media/revisions";

/** D1's "YYYY-MM-DD HH:MM:SS" (UTC) or an ISO time, as an ISO time. */
function isoOf(value: string | null | undefined): string {
  const at = value ? Date.parse(value.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/, "$1T$2Z")) : Number.NaN;
  return new Date(Number.isNaN(at) ? Date.now() : at).toISOString();
}

/** The revision a file with no history has: the bytes it holds now, as it was uploaded or imported. */
function firstOf(row: MediaRow): Omit<MediaRevisionRow, "id" | "backupKey"> {
  return {
    mediaKey: row.key,
    at: isoOf(row.uploadedAt),
    bytes: row.bytes,
    width: row.width,
    height: row.height,
    reason: row.sourceUrl ? "import" : "upload",
    sha256: row.sha256,
  };
}

/** The history as the contract answers it, newest first, exactly one current. A file never changed has one. */
export async function historyOf(env: Env, row: MediaRow) {
  const rows = await mediaRevisionsOf(env, row.key);
  const listed = rows.length > 0 ? rows : [{ id: 0, ...firstOf(row) }];
  return listed.map((r, n) => ({
    rev: String(r.id),
    at: isoOf(r.at),
    bytes: r.bytes,
    width: r.width && r.width > 0 ? r.width : null,
    height: r.height && r.height > 0 ? r.height : null,
    reason: r.reason,
    current: n === 0,
  }));
}

/** The bytes an earlier revision kept, or null for one this file never had or whose copy is gone. */
export async function revisionBytes(env: Env, key: string, rev: string): Promise<{ row: MediaRevisionRow; bytes: Uint8Array } | null> {
  const row = (await mediaRevisionsOf(env, key)).find((r) => String(r.id) === rev);
  if (!row?.backupKey) return null;
  const kept = await env.BACKUPS.get(row.backupKey);
  if (!kept) return null;
  return { row, bytes: new Uint8Array(await kept.arrayBuffer()) };
}

/** Copies bytes to BACKUPS for the history and answers where they went. */
export async function keepBytes(env: Env, key: string, body: ReadableStream | ArrayBuffer | Uint8Array, contentType: string): Promise<string> {
  const backupKey = `${BACKUP_PREFIX}/${new Date().toISOString()}/${key}`;
  await env.BACKUPS.put(backupKey, body, { httpMetadata: { contentType } });
  return backupKey;
}

/** Keeps the bytes a file has now as an earlier revision, recording its first revision if it had no history. */
async function keepCurrentBytes(env: Env, row: MediaRow): Promise<void> {
  const current = await env.BLOG_IMAGES.get(row.key);
  if (!current) throw new NotFoundError("No such media.");
  const backupKey = await keepBytes(env, row.key, current.body, row.contentType);
  const [latest] = await mediaRevisionsOf(env, row.key, 1);
  const id = latest?.id ?? (await addMediaRevision(env, firstOf(row)));
  await keepMediaRevision(env, id, backupKey);
}

/**
 * Puts new bytes under a file's key as its newest revision, the old ones kept first: the one way a stored image's bytes
 * change (replace, transform, shrink, revert). The caller has already claimed the version (writeAtRev). The object's
 * width and height metadata, which every page sizes the image by, follow the new picture; its focal point is `focus`.
 */
export async function swapBytes(
  env: Env,
  row: MediaRow,
  next: { bytes: Uint8Array; contentType: string; width: number | null; height: number | null; reason: RevisionReason; focus: string | null },
  columns: MediaFields = {},
): Promise<void> {
  await keepCurrentBytes(env, row);
  // The binding's `put` takes a wider `onlyIf` than the helper's narrow interface names; the shapes it uses agree.
  const bucket = env.BLOG_IMAGES as unknown as R2BucketLike;
  const written = await replaceObject(bucket, row.key, { bytes: next.bytes, contentType: next.contentType });
  // replaceObject keeps the custom metadata less the focal point; the size and the point are put back for this picture.
  const { width: _w, height: _h, ...kept } = written.customMetadata ?? {};
  const meta: Record<string, string> = {
    ...kept,
    ...(next.width && next.height ? { width: String(next.width), height: String(next.height) } : {}),
    ...(next.focus ? { [FOCUS_METADATA]: next.focus } : {}),
  };
  if (JSON.stringify(meta) !== JSON.stringify(written.customMetadata ?? {})) {
    const settled = await env.BLOG_IMAGES.put(row.key, next.bytes, {
      httpMetadata: written.httpMetadata as R2HTTPMetadata,
      customMetadata: meta,
      onlyIf: { etagMatches: written.etag },
    });
    if (!settled) throw new RefusedError("The file changed on the site while this was being written. Try again.");
  }
  const sha256 = await sha256Hex(next.bytes);
  await addMediaRevision(env, {
    mediaKey: row.key,
    at: new Date().toISOString(),
    bytes: next.bytes.byteLength,
    width: next.width,
    height: next.height,
    reason: next.reason,
    sha256,
  });
  // New bytes, new placeholder: two billed transforms, skipped for a file the binding could not measure.
  const { placeholder, color } = next.width ? await placeholderAndColor(env.IMAGES, next.bytes) : { placeholder: null, color: null };
  await followMedia(env, row.key, { bytes: next.bytes.byteLength, width: next.width, height: next.height, sha256, focus: next.focus, placeholder, color, ...columns });
}
