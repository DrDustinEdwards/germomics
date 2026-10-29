// R2 helpers. Audio → MEDIA (germomics-audio, public via media.germomics.com); images →
// BLOG_IMAGES; game assets read from GAME_ASSETS. Reads/writes go through the native bindings
// only, never over HTTP.
//
// Where URLs point (germomics invariant). Enclosure/media URLs ALWAYS point at
// media.germomics.com, never the worker origin. An image's stored URL (a body, a cover, a feed) is
// its original at images.germomics.com; the resized copies a page shows come from germomics.com,
// /media/<key>?w= (app/lib/images.ts, Dustin 2026-10-29), made from that original on request.
import { IMAGE_ORIGIN as IMAGE_BASE, MEDIA_ORIGIN as MEDIA_BASE } from "~/lib/site";

function mediaUrl(key: string): string {
  return `${MEDIA_BASE}/${key.replace(/^\/+/, "")}`;
}
export function imageUrl(key: string): string {
  return `${IMAGE_BASE}/${key.replace(/^\/+/, "")}`;
}

/** Build a collision-resistant, filesystem-safe object key under a folder. */
export function buildKey(folder: string, filename: string): string {
  const safe = filename.replace(/[^\w.-]/g, "_").replace(/_{2,}/g, "_").slice(-80);
  return `${folder.replace(/^\/+|\/+$/g, "")}/${Date.now()}-${safe}`;
}

export async function uploadAudio(
  env: Env,
  key: string,
  body: ArrayBuffer | ReadableStream,
  contentType = "audio/mpeg",
): Promise<{ url: string; size: number }> {
  const obj = await env.MEDIA.put(key, body, {
    httpMetadata: { contentType },
  });
  return { url: mediaUrl(key), size: obj?.size ?? 0 };
}

export async function uploadImage(
  env: Env,
  key: string,
  body: ArrayBuffer | ReadableStream,
  contentType: string,
  customMetadata?: Record<string, string>,
): Promise<string> {
  await env.BLOG_IMAGES.put(key, body, { httpMetadata: { contentType }, customMetadata });
  return imageUrl(key);
}

/** Stream a game asset (sprite/sfx/wasm) from R2 over the CDN-cached binding. */
export async function getGameAsset(env: Env, key: string): Promise<R2ObjectBody | null> {
  return env.GAME_ASSETS.get(key);
}
