// Carrel's media group (site-api v0.13.1) over the images in BLOG_IMAGES and their rows in D1 (app/lib/media/): the
// object is the bytes and the public address (images.germomics.com/<key>), the `media` row is everything else, and the
// row's `rev` is the file's version, checked and moved in the same statement as every write (writeAtRev), so a stale
// write is a 409 and never a lost update. Used by comes from the content itself (app/lib/media/usage.server.ts).
//
// Offered: list and search, upload, alt, tags, trash and restore, delete, focal point, caption, replace, duplicates by
// SHA-256, usage counts and the used sort, the six lenses, orientation and kind filters, import from an https address,
// credit and license, turns and mirrors through the Images binding, a byte history with revert (the old bytes kept in
// BACKUPS), the change log a screen polls (triggers on `media`), shrinking large pictures at upload and in a pass over
// stored ones, embedded credit, copyright, description and date, and suggested tags and alt text from Workers AI.
//
// An upload goes through site-api's prepareUpload: its byte checks, HEIC to JPEG, the location taken out, the shrink
// and the embedded fields, and its placeholder and main color, kept on the row (0016) and made again when the bytes change.
import { rerenderUsing } from "~/lib/render.server";
import {
  MediaId,
  MediaInUseError,
  NotFoundError,
  RefusedError,
  VersionConflictError,
  kindOf,
  orientationOf,
  prepareUpload,
  transformFocus,
  turnsSize,
  type MediaAdapter,
  type MediaItem,
  type MediaLens,
  type MediaResize,
  type MediaUploadLimits,
  type MediaTransformOp,
} from "@dustinedwards/site-api";
import { writeFocus, type R2BucketLike } from "@dustinedwards/site-api/r2";
import { editImage } from "@dustinedwards/site-runtime/image";
import { historyOf, keepBytes, revisionBytes, swapBytes } from "~/lib/media/revisions.server";
import {
  addMediaRevision,
  allMediaRows,
  deleteMediaRow,
  followMedia,
  mediaByHash,
  mediaChangeCursor,
  mediaChangedSince,
  mediaRow,
  mediaRows,
  mediaTwins,
  recordUpload,
  sizeMetadata,
  writeAtRev,
  type MediaFields,
  type MediaRow,
} from "~/lib/media/store.server";
import { suggestFor } from "~/lib/media/suggest.server";
import { mediaPlaces, usageCounts, usesOfKey } from "~/lib/media/usage.server";
import { buildKey, imageUrl } from "~/lib/r2.server";

/** What Carrel may upload; HEIC and HEIF are stored as JPEG (prepareUpload). */
export const LIMITS: MediaUploadLimits = {
  maxBytes: 10 * 1024 * 1024,
  types: ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif", "image/heic", "image/heif"],
};
const LARGE_BYTES = 1024 * 1024;

/** The ready-made views, each computed here over the whole library. */
const LENSES: readonly MediaLens[] = ["unattached", "no-alt", "large", "duplicates", "license-expired", "oversized"];

/**
 * What an upload shrinks to unless it says `resize=no`: the longer edge kept and the quality, dustinedwards.info's
 * values. A phone photo (4032 pixels) keeps its size; a larger camera file is shrunk, its original kept in the history.
 */
export const RESIZE: MediaResize = { maxEdge: 4096, quality: 85 };

/** The quality a turn or a mirror encodes at: high, since each one re-encodes a lossy picture. */
const TRANSFORM_QUALITY = 92;

/** Pictures the Images binding re-encodes in their own type. A GIF is left out: it may be animated, and an edit keeps one frame. */
const REENCODED = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
type Encoded = "image/jpeg" | "image/png" | "image/webp" | "image/avif";
type Edit = Pick<Parameters<typeof editImage>[2], "rotate" | "flip" | "maxEdge">;

/** Each transform as editImage's options. A quarter turn is clockwise, as the contract's rotate-90 is. */
const TRANSFORMS: Record<MediaTransformOp, Edit> = {
  "rotate-90": { rotate: 90 },
  "rotate-180": { rotate: 180 },
  "rotate-270": { rotate: 270 },
  "flip-h": { flip: "h" },
  "flip-v": { flip: "v" },
};

type Size = { width: number; height: number };

/** The picture's size, read by the Images binding; null without the binding or for a file it cannot read. */
async function measure(env: Env, bytes: Uint8Array): Promise<Size | null> {
  if (!env.IMAGES) return null;
  try {
    const info = await env.IMAGES.info(new Blob([bytes as BlobPart]).stream());
    return "width" in info && info.width && info.height ? { width: info.width, height: info.height } : null;
  } catch {
    return null;
  }
}

/** One edit through the Images binding (site-runtime's editImage), answering the new bytes in the picture's own type. */
async function reencode(env: Env, body: ReadableStream | Uint8Array, edit: Edit, format: Encoded, quality: number): Promise<Uint8Array> {
  if (!env.IMAGES) throw new RefusedError("This site has no Images binding, so it cannot edit pictures.");
  const response = await editImage(env.IMAGES, body, { ...edit, format, quality });
  return new Uint8Array(await response.arrayBuffer());
}

/** The size a picture fits to inside RESIZE, or null when it already fits. */
function shrunk(width: number | null, height: number | null): Size | null {
  if (!width || !height || Math.max(width, height) <= RESIZE.maxEdge) return null;
  const scale = RESIZE.maxEdge / Math.max(width, height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

const versionOf = (rev: number) => `r${rev}`;

/** The rev a version names, or -1 (which no row holds) for anything this site never answered. */
const revOf = (version: string) => (/^r(0|[1-9]\d{0,15})$/.test(version) ? Number(version.slice(1)) : -1);

const isoOrNull = (value: string | null) => {
  const at = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(at) ? null : new Date(at).toISOString();
};

/** One row in the contract's terms. Every file in BLOG_IMAGES is an upload, so every one may be deleted once unused. */
function itemOf(row: MediaRow, usedCount?: number): MediaItem {
  const url = imageUrl(row.key);
  return {
    id: row.key,
    url,
    filename: row.filename ? row.filename.slice(0, 300) : null,
    contentType: row.contentType,
    bytes: row.bytes,
    width: row.width && row.width > 0 ? row.width : null,
    height: row.height && row.height > 0 ? row.height : null,
    alt: row.alt,
    uploadedAt: isoOrNull(row.uploadedAt),
    deletable: true,
    version: versionOf(row.rev),
    tags: row.tags,
    trashedAt: isoOrNull(row.trashedAt),
    focus: row.focus,
    caption: row.caption,
    ...(usedCount === undefined ? {} : { usedCount }),
    placeholder: row.placeholder,
    color: row.color,
    credit: row.credit,
    license: row.license,
    sourceUrl: row.sourceUrl,
    licenseExpires: row.licenseExpires,
    takenAt: row.takenAt,
    downloadUrl: url,
  };
}

/** Writes `fields` at the version the caller loaded, or says why not in the contract's errors. */
async function atVersion(env: Env, id: string, expectedVersion: string, fields: MediaFields): Promise<{ version: string }> {
  const written = await writeAtRev(env, id, fields, revOf(expectedVersion));
  if (written.ok) return { version: versionOf(written.rev) };
  if (written.reason === "missing") throw new NotFoundError("No such media.");
  throw new VersionConflictError(versionOf(written.rev), "The file changed since it was loaded.");
}

/** The row, or NotFound. */
async function rowOf(env: Env, id: string): Promise<MediaRow> {
  const row = await mediaRow(env, id);
  if (!row) throw new NotFoundError("No such media.");
  return row;
}

/** The row again after a write, which must be there. */
async function reread(env: Env, id: string, what: string): Promise<MediaRow> {
  const row = await mediaRow(env, id);
  if (!row) throw new Error(`${id} was ${what}, but its row cannot be read`);
  return row;
}

type Log = (event: string, id: string, version: string, changeId: string) => void;

export function carrelMedia(env: Env, recordChange: Log): MediaAdapter {
  // The binding's `put` takes a wider `onlyIf` than the helpers' narrow interface names; the shapes they use agree.
  const bucket = env.BLOG_IMAGES as unknown as R2BucketLike;

  /** A write's answer, logged with Carrel's change id. */
  const logged = <T extends { version: string }>(event: string, id: string, changeId: string, result: T): T => {
    recordChange(event, id, result.version, changeId);
    return result;
  };

  /** Claims the version for a write that changes the object before the row: a stale writer is refused before any byte moves. */
  const claim = (id: string, expectedVersion: string) => atVersion(env, id, expectedVersion, {});

  return {
    limits: LIMITS,
    lenses: LENSES,
    usage: true,
    filters: true,
    resize: RESIZE,
    readsEmbedded: true,
    // The package checks every address and each redirect before this fetch runs.
    importFetch: ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init)) as typeof fetch,

    async list(query) {
      // The cursor first: a change that lands while the page is read is in the next poll, not lost between them.
      const changeCursor = String(await mediaChangeCursor(env));
      const [rows, places] = await Promise.all([allMediaRows(env), mediaPlaces(env)]);
      const counts = usageCounts(places);
      const hashes = new Map<string, number>();
      for (const r of rows) if (r.sha256) hashes.set(r.sha256, (hashes.get(r.sha256) ?? 0) + 1);
      const today = new Date().toISOString().slice(0, 10);
      const lens: Record<MediaLens, (r: MediaRow) => boolean> = {
        unattached: (r) => !counts.get(r.key),
        "no-alt": (r) => r.alt.trim() === "",
        large: (r) => r.bytes > LARGE_BYTES,
        duplicates: (r) => Boolean(r.sha256 && (hashes.get(r.sha256) ?? 0) > 1),
        "license-expired": (r) => Boolean(r.licenseExpires && r.licenseExpires < today),
        oversized: (r) => shrunk(r.width, r.height) !== null,
      };

      const trashed = query.trashed === "only";
      const needle = query.q?.toLowerCase();
      const matching = rows
        .filter((r) => MediaId.safeParse(r.key).success)
        .filter((r) => (trashed ? r.trashedAt !== null : r.trashedAt === null))
        .filter((r) => !needle || [r.key, r.filename ?? "", r.alt, r.caption].some((t) => t.toLowerCase().includes(needle)))
        .filter((r) => !query.tag || r.tags.includes(query.tag))
        .filter((r) => !query.lens || lens[query.lens](r))
        .filter((r) => !query.orientation || orientationOf(r.width, r.height) === query.orientation)
        .filter((r) => !query.kind || kindOf(r.contentType) === query.kind);

      // The contract's defaults: added, size and used run largest first, name A to Z. The trash is newest trashed first.
      const sort = query.sort ?? "added";
      const dir = query.dir ?? (sort === "name" ? "asc" : "desc");
      const keyOf = (r: MediaRow): string | number =>
        trashed ? (r.trashedAt ?? "") : sort === "size" ? r.bytes : sort === "used" ? (counts.get(r.key) ?? 0) : sort === "name" ? (r.filename ?? r.key).toLowerCase() : r.uploadedAt;
      const order = trashed ? "desc" : dir;
      matching.sort((a, b) => {
        const [x, y] = [keyOf(a), keyOf(b)];
        const by = typeof x === "number" ? x - (y as number) : x.localeCompare(y as string);
        return (order === "asc" ? 1 : -1) * by || a.key.localeCompare(b.key);
      });

      const start = query.cursor && /^[1-9]\d{0,8}$/.test(query.cursor) ? Number(query.cursor) : 0;
      const page = matching.slice(start, start + query.limit);
      return {
        items: page.map((r) => itemOf(r, counts.get(r.key) ?? 0)),
        nextCursor: start + query.limit < matching.length ? String(start + query.limit) : null,
        total: matching.length,
        ...(trashed ? {} : { sorted: { sort, dir } }),
        changeCursor,
      };
    },

    async get(id) {
      const row = await mediaRow(env, id);
      if (!row) return null;
      const usedBy = usesOfKey(await mediaPlaces(env), id);
      const twins = (await mediaTwins(env, row.sha256, id))
        .filter((t) => MediaId.safeParse(t.key).success)
        .slice(0, 50)
        .map((t) => ({ id: t.key, filename: t.filename ? t.filename.slice(0, 300) : null }));
      return { ...itemOf(row, usedBy.length), usedBy, twins };
    },

    async upload(input) {
      const prepared = await prepareUpload(env.IMAGES, input, { resize: RESIZE });
      const { width, height, resizedFrom, original } = prepared;
      const key = buildKey("carrel", prepared.filename);
      const at = new Date().toISOString();
      await env.BLOG_IMAGES.put(key, prepared.bytes, {
        httpMetadata: { contentType: prepared.contentType },
        // The size is what every page sizes the image by (images.server.ts reads it from the object).
        customMetadata: { filename: prepared.filename, changeId: input.changeId, ...sizeMetadata(prepared) },
      });
      try {
        await recordUpload(env, key, prepared, { alt: input.alt, sourceUrl: input.sourceUrl ?? null, uploadedAt: at });
      } catch (error) {
        // Nothing names a key made a moment ago, so the object goes with the row that failed.
        await env.BLOG_IMAGES.delete(key);
        throw error;
      }
      if (resizedFrom && original) {
        // The original in BACKUPS and in the file's history, as the revision the shrink replaced.
        const backupKey = await keepBytes(env, key, original, prepared.contentType);
        const reason = input.sourceUrl ? "import" : "upload";
        await addMediaRevision(env, { mediaKey: key, at, bytes: resizedFrom.bytes, width: resizedFrom.width, height: resizedFrom.height, reason, sha256: prepared.uploadSha256, backupKey });
        await addMediaRevision(env, { mediaKey: key, at, bytes: prepared.bytes.byteLength, width, height, reason: "resize", sha256: prepared.sha256 });
      }
      const item = itemOf(await reread(env, key, "stored"), 0);
      recordChange("media.upload", key, item.version!, input.changeId);
      const embedded = (["credit", "license", "caption", "takenAt"] as const).filter((field) => prepared.embedded[field]);
      return { ...item, ...(embedded.length > 0 ? { embedded } : {}), ...(resizedFrom ? { resizedFrom } : {}) };
    },

    async delete(id, { changeId }) {
      await rowOf(env, id);
      let uses;
      try {
        uses = usesOfKey(await mediaPlaces(env), id);
      } catch {
        // A delete the site could not check is never made.
        throw new RefusedError("The check for where this image is used could not run, so it was not deleted.");
      }
      if (uses.length > 0) throw new MediaInUseError(uses);
      // Row first: an object left without one is found again by the backfill, never served as a library file.
      await deleteMediaRow(env, id);
      await env.BLOG_IMAGES.delete(id);
      recordChange("media.delete", id, "deleted", changeId);
    },

    setAlt: (id, { alt, expectedVersion, changeId }) => atVersion(env, id, expectedVersion, { alt }).then((r) => logged("media.alt", id, changeId, r)),

    // Already in the contract's spelling, unique and sorted by the package.
    setTags: (id, { tags, expectedVersion, changeId }) => atVersion(env, id, expectedVersion, { tags }).then((r) => logged("media.tags", id, changeId, r)),

    // A trashed file keeps its object and address, so a page that uses it is unchanged.
    trash: (id, { expectedVersion, changeId }) =>
      atVersion(env, id, expectedVersion, { trashedAt: new Date().toISOString() }).then((r) => logged("media.trash", id, changeId, r)),

    restore: (id, { expectedVersion, changeId }) => atVersion(env, id, expectedVersion, { trashedAt: null }).then((r) => logged("media.restore", id, changeId, r)),

    setCaption: (id, { caption, expectedVersion, changeId }) =>
      atVersion(env, id, expectedVersion, { caption }).then((r) => logged("media.caption", id, changeId, r)),

    setCredit: (id, { credit, license, sourceUrl, licenseExpires, expectedVersion, changeId }) =>
      atVersion(env, id, expectedVersion, { credit, license, sourceUrl, licenseExpires }).then((r) => logged("media.credit", id, changeId, r)),

    // The object's customMetadata `focus` is what /media crops around; the row keeps the same point for the library.
    async setFocus(id, { focus, expectedVersion, changeId }) {
      const claimed = await claim(id, expectedVersion);
      await writeFocus(bucket, id, focus);
      await followMedia(env, id, { focus });
      return logged("media.focus", id, changeId, claimed);
    },

    // The same key and address with new bytes: alt, caption, tags and credit kept, the focal point cleared, the size
    // measured again. /media keys its cached sizes by the object's etag (site-runtime 0.27), so none is stale.
    async replace(id, { bytes, contentType, expectedVersion, changeId }) {
      const size = await measure(env, bytes);
      const claimed = await claim(id, expectedVersion);
      const row = await rowOf(env, id);
      await swapBytes(env, row, { bytes, contentType, width: size?.width ?? null, height: size?.height ?? null, reason: "replace", focus: null });
      recordChange("media.replace", id, claimed.version, changeId);
      // Bodies carry the file's version in their size URLs; re-rendering them is what shows the new picture.
      await rerenderUsing(env, id);
      return { item: itemOf(await reread(env, id, "replaced")), sizesNeedPurge: false };
    },

    async findByHash(sha256) {
      const row = await mediaByHash(env, sha256);
      return row && MediaId.safeParse(row.key).success ? itemOf(row) : null;
    },

    // In place, through the Images binding, in the picture's own type. The site's addresses do not carry the size
    // (replaceKeepsSize is not set), so the package never asks for a new file; but a figure in a post body records its
    // width and height, so a quarter turn of a picture that is not square, and that a page uses, is refused.
    async transform(id, { op, expectedVersion, changeId }) {
      const row = await rowOf(env, id);
      if (!REENCODED.has(row.contentType)) {
        throw new RefusedError(`A ${row.contentType} picture is not turned here: a GIF may be animated, and a turn would keep one frame.`);
      }
      const swaps = turnsSize(op) && orientationOf(row.width, row.height) !== "square";
      if (swaps && usesOfKey(await mediaPlaces(env), id).length > 0) {
        throw new RefusedError(
          "This picture is used on the site, where its figures record its width and height, and a quarter turn would swap them. " +
            "Upload the turned picture as a new file and put it in place instead.",
        );
      }
      const object = await env.BLOG_IMAGES.get(id);
      if (!object) throw new NotFoundError("No such media.");
      const bytes = await reencode(env, object.body, TRANSFORMS[op], row.contentType as Encoded, TRANSFORM_QUALITY);
      const width = turnsSize(op) ? row.height : row.width;
      const height = turnsSize(op) ? row.width : row.height;
      const claimed = await claim(id, expectedVersion);
      // The focal point moves with the picture rather than being cleared.
      await swapBytes(env, row, { bytes, contentType: row.contentType, width, height, reason: "transform", focus: transformFocus(row.focus, op) });
      recordChange("media.transform", id, claimed.version, changeId);
      // Bodies carry the file's version in their size URLs; re-rendering them is what shows the new picture.
      await rerenderUsing(env, id);
      return { item: itemOf(await reread(env, id, "turned")), sizesNeedPurge: false };
    },

    async history(id) {
      const row = await mediaRow(env, id);
      return row ? historyOf(env, row) : null;
    },

    // The package has checked that `to` is an earlier revision; the bytes come back from the copy it kept, as a new
    // revision, so a revert is itself undone by another. The focal point is cleared, as a replace clears it.
    async revert(id, { to, expectedVersion, changeId }) {
      const row = await rowOf(env, id);
      const kept = await revisionBytes(env, id, to);
      if (!kept) throw new NotFoundError("This file has no such earlier version, or its copy is gone.");
      const claimed = await claim(id, expectedVersion);
      await swapBytes(env, row, { bytes: kept.bytes, contentType: row.contentType, width: kept.row.width, height: kept.row.height, reason: "revert", focus: null });
      recordChange("media.revert", id, claimed.version, changeId);
      // Bodies carry the file's version in their size URLs; re-rendering them is what shows the new picture.
      await rerenderUsing(env, id);
      return { item: itemOf(await reread(env, id, "reverted")), sizesNeedPurge: false };
    },

    // One stored picture shrunk to RESIZE in place, its proportions and focal point kept and its old bytes kept in the
    // history. A picture already within the size answers as it is.
    async shrink(id, { expectedVersion, changeId }) {
      const row = await rowOf(env, id);
      const small = REENCODED.has(row.contentType) ? shrunk(row.width, row.height) : null;
      if (!small) {
        if (row.rev !== revOf(expectedVersion)) throw new VersionConflictError(versionOf(row.rev), "The file changed since it was loaded.");
        return { resized: false, item: itemOf(row) };
      }
      const object = await env.BLOG_IMAGES.get(id);
      if (!object) throw new NotFoundError("No such media.");
      const bytes = await reencode(env, object.body, { maxEdge: RESIZE.maxEdge }, row.contentType as Encoded, RESIZE.quality);
      const size = (await measure(env, bytes)) ?? small;
      const claimed = await claim(id, expectedVersion);
      await swapBytes(env, row, { bytes, contentType: row.contentType, ...size, reason: "resize", focus: row.focus });
      recordChange("media.resize", id, claimed.version, changeId);
      await rerenderUsing(env, id);
      return { resized: true, item: itemOf(await reread(env, id, "shrunk")) };
    },

    // From the change log the triggers on `media` write: every insert, update and delete of a row.
    async changes({ since, limit }) {
      const refused = () => new RefusedError("That change cursor is not this site's; reload the library.");
      if (!/^(0|[1-9]\d{0,15})$/.test(since)) throw refused();
      const head = await mediaChangeCursor(env);
      const from = Number(since);
      if (from > head) throw refused();
      const changed = await mediaChangedSince(env, from, head, limit);
      const more = changed.length > limit;
      const taken = changed.slice(0, limit).filter((c) => MediaId.safeParse(c.key).success);
      const rows = new Map((await mediaRows(env, taken.map((c) => c.key))).map((row) => [row.key, row]));
      const counts = usageCounts(await mediaPlaces(env));
      return {
        items: taken.flatMap((c) => (rows.has(c.key) ? [itemOf(rows.get(c.key)!, counts.get(c.key) ?? 0)] : [])),
        removed: taken.filter((c) => !rows.has(c.key)).map((c) => c.key),
        cursor: String(more ? changed[limit - 1]!.seq : head),
        more,
      };
    },

    // Never applied: Carrel shows them, and a person accepts each as an alt or tags write.
    async suggest(id) {
      const row = await mediaRow(env, id);
      if (!row) return null;
      const object = await env.BLOG_IMAGES.get(id);
      if (!object) return null;
      try {
        return await suggestFor(env, object);
      } catch (error) {
        throw new RefusedError(`No suggestion was made: ${error instanceof Error ? error.message : String(error)}.`);
      }
    },
  };
}
