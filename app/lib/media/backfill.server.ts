// The one move of the images already in BLOG_IMAGES into the media table (drizzle/0015_media_library.sql), a batch at
// a time from POST /admin/media/backfill. Each object without a row gets one, carrying what the object already says
// (its type, size, alt, filename and focal point, from its R2 metadata), its caption from media_captions (0014), the
// SHA-256 of its bytes, and its width and height (from its metadata, else measured by the Images binding). It never
// changes an object and never overwrites a row, so it is safe to run again: a second run adds only what is missing.
import { sha256Hex } from "@dustinedwards/site-api";
import { FOCUS_METADATA, focusOf } from "@dustinedwards/site-runtime/image";
import { logEvent } from "@dustinedwards/site-runtime/log";
import { inArray } from "drizzle-orm";
import { getDb } from "~/db/index.server";
import { mediaCaptions } from "~/db/schema";
import { insertMediaRow, mediaRows } from "./store.server";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", avif: "image/avif", svg: "image/svg+xml" };

const positive = (v: string | number | null | undefined): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

async function measured(env: Env, bytes: ArrayBuffer): Promise<{ width: number; height: number } | null> {
  if (!env.IMAGES) return null;
  try {
    const info = await env.IMAGES.info(new Blob([bytes]).stream());
    return "width" in info && info.width && info.height ? { width: info.width, height: info.height } : null;
  } catch {
    return null;
  }
}

export type BackfillResult = { scanned: number; added: string[]; cursor: string | null; done: boolean };

/** One batch of the bucket, in its own order: up to `limit` objects listed, a row made for each one without. */
export async function backfillMedia(env: Env, { cursor, limit = 50 }: { cursor?: string | null; limit?: number } = {}): Promise<BackfillResult> {
  const listed = await env.BLOG_IMAGES.list({ limit: Math.min(Math.max(1, limit), 100), cursor: cursor || undefined, include: ["httpMetadata", "customMetadata"] });
  const keys = listed.objects.map((o) => o.key);
  const held = new Set((await mediaRows(env, keys)).map((r) => r.key));
  const waiting = listed.objects.filter((o) => !held.has(o.key));
  const captions =
    waiting.length > 0
      ? new Map(
          (await getDb(env).select().from(mediaCaptions).where(inArray(mediaCaptions.mediaKey, waiting.map((o) => o.key)))).map((c) => [c.mediaKey, c.caption]),
        )
      : new Map<string, string>();

  const added: string[] = [];
  for (const listedObject of waiting) {
    const object = await env.BLOG_IMAGES.get(listedObject.key);
    if (!object) continue; // deleted since the list
    const bytes = await object.arrayBuffer();
    const meta = object.customMetadata ?? {};
    const ext = object.key.split(".").pop()?.toLowerCase() ?? "";
    const named = { width: positive(meta.width), height: positive(meta.height) };
    const size = named.width && named.height ? named : ((await measured(env, bytes)) ?? { width: null, height: null });
    const made = await insertMediaRow(
      env,
      {
        key: object.key,
        filename: meta.filename ?? object.key.split("/").pop() ?? null,
        contentType: object.httpMetadata?.contentType?.split(";")[0]?.trim() || TYPES[ext] || "application/octet-stream",
        bytes: object.size,
        width: size.width,
        height: size.height,
        alt: meta.alt ?? "",
        caption: captions.get(object.key) ?? "",
        focus: focusOf(meta[FOCUS_METADATA]),
        sha256: await sha256Hex(new Uint8Array(bytes)),
        uploadedAt: object.uploaded.toISOString(),
      },
      { ifAbsent: true },
    );
    if (made) added.push(object.key);
  }
  const next = listed.truncated ? (listed.cursor ?? null) : null;
  return { scanned: listed.objects.length, added, cursor: next, done: next === null };
}

const BACKFILL_KEY = "media:backfill";

/**
 * The every-minute cron's share of the move, so nobody has to start it by hand: one batch a minute from where the last
 * one stopped, until the bucket has been walked once. Where it stopped (the list cursor, or "done") is kept in APP_KV.
 */
export async function continueMediaBackfill(env: Env): Promise<void> {
  const state = await env.APP_KV.get(BACKFILL_KEY);
  if (state === "done") return;
  const batch = await backfillMedia(env, { cursor: state });
  await env.APP_KV.put(BACKFILL_KEY, batch.cursor ?? "done");
  if (batch.added.length > 0) logEvent("media_backfill_batch", { added: batch.added.length, done: batch.done });
}
