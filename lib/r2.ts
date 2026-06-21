// lib/r2.ts R2 access over the native bindings. MEDIA -> germomics-audio (audio),
// IMAGES -> germomics-blog-images. Public reads are served from the custom domains, never
// the Worker origin: enclosure URLs ALWAYS point at media.germomics.com.

import { getCloudflareContext } from '@opennextjs/cloudflare';
import { MEDIA_HOST, IMAGES_HOST } from '@/lib/constants';

export function mediaBucket(): R2Bucket {
  return getCloudflareContext().env.MEDIA;
}

export function imagesBucket(): R2Bucket {
  return getCloudflareContext().env.BLOG_IMAGES;
}

/** Public URL for an audio object. Used for RSS enclosures and the player. */
export function mediaUrl(key: string): string {
  return `https://${MEDIA_HOST}/${key.replace(/^\/+/, '')}`;
}

/** Public URL for an image object. */
export function imageUrl(key: string): string {
  return `https://${IMAGES_HOST}/${key.replace(/^\/+/, '')}`;
}

type PutResult = { key: string; url: string; size: number; contentType: string };

/** Upload an audio file to germomics-audio and return its public media.germomics.com URL. */
export async function putMedia(
  key: string,
  body: ArrayBuffer | ReadableStream | Uint8Array,
  contentType = 'audio/mpeg',
): Promise<PutResult> {
  const obj = await mediaBucket().put(key, body, {
    httpMetadata: { contentType },
  });
  return { key, url: mediaUrl(key), size: obj?.size ?? 0, contentType };
}

/** Upload an image to germomics-blog-images and return its public images.germomics.com URL. */
export async function putImage(
  key: string,
  body: ArrayBuffer | ReadableStream | Uint8Array,
  contentType = 'image/jpeg',
): Promise<PutResult> {
  const obj = await imagesBucket().put(key, body, {
    httpMetadata: { contentType },
  });
  return { key, url: imageUrl(key), size: obj?.size ?? 0, contentType };
}
