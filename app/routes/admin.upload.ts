// Admin upload endpoint — drag-drop / file-picker target for the editor's dual-input fields.
// Resource route (action only) under the admin.* gate (admin.tsx middleware runs first), so it
// is never publicly writable. Writes the file into R2 via the native binding and returns JSON the
// client uses to fill the field. Images → images.germomics.com (BLOG_IMAGES), through site-api's
// prepareUpload, with their width and height as custom metadata so pages can offer resized copies
// from /media, and a row in the media library; audio → media.germomics.com (germomics-audio).
import type { Route } from "./+types/admin.upload";
import { getEnv } from "~/lib/context.server";
import { uploadAudio, uploadImage, buildKey } from "~/lib/r2.server";
import { RefusedError, prepareUpload } from "@dustinedwards/site-api";
import { logEvent } from "@dustinedwards/site-runtime/log";
import { LIMITS, RESIZE } from "~/lib/carrel/media.server";
import { recordUpload, sizeMetadata } from "~/lib/media/store.server";
import { readForm } from "~/lib/body.server";

const MAX_IMAGE = 25 * 1024 * 1024; // 25 MB
// Cloudflare refuses a request body over 100 MB on the Free and Pro plans before the Worker sees it,
// so a larger cap only promised uploads that could never arrive (Grok audit 2026-10-21, GE-9).
// An hour of 128 kbps MP3 is about 58 MB.
const MAX_AUDIO = 100 * 1024 * 1024; // 100 MB

export async function action({ request, context }: Route.ActionArgs) {
  const env = getEnv(context);
  // The largest file plus room for the form around it.
  const form = await readForm(request, MAX_AUDIO + 1024 * 1024);
  const file = form.get("file");
  const kind = String(form.get("kind") || "");
  const postId = String(form.get("postId") || "misc").replace(/[^\w-]/g, "") || "misc";

  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ ok: false, error: "No file received." }, { status: 400 });
  }

  if (kind === "image") {
    if (file.size > MAX_IMAGE) {
      return Response.json({ ok: false, error: "Image exceeds 25 MB." }, { status: 413 });
    }
    // The bytes are checked against the type (an SVG or anything unknown is refused), a HEIC becomes a JPEG, a location
    // is taken out and a camera-sized picture shrunk, as Carrel's uploads are.
    let prepared;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const input = { bytes, contentType: file.type, filename: file.name, alt: "", changeId: "", resize: true };
      prepared = await prepareUpload(env.IMAGES, input, { resize: RESIZE, limits: { ...LIMITS, maxBytes: MAX_IMAGE } });
    } catch (error) {
      if (error instanceof RefusedError) return Response.json({ ok: false, error: error.message }, { status: 415 });
      throw error;
    }
    const key = buildKey(`posts/${postId}`, prepared.filename);
    const url = await uploadImage(env, key, prepared.bytes, prepared.contentType, sizeMetadata(prepared));
    // Into the media library too (Carrel's media page). The image is stored and its address works either way; a row
    // that could not be written is made by the next backfill (POST /admin/media/backfill).
    await recordUpload(env, key, prepared).catch((error) =>
      logEvent("media_record_failed", { key, error }, { level: "error" }),
    );
    return Response.json({ ok: true, url, contentType: prepared.contentType, name: prepared.filename, size: prepared.bytes.byteLength });
  }

  if (kind === "audio") {
    if (file.size > MAX_AUDIO) {
      return Response.json({ ok: false, error: "Audio exceeds 100 MB." }, { status: 413 });
    }
    const key = buildKey(`episodes/${postId}`, file.name);
    const ct = file.type || "audio/mpeg";
    const { url, size } = await uploadAudio(env, key, await file.arrayBuffer(), ct);
    return Response.json({ ok: true, url, size, contentType: ct, name: file.name });
  }

  return Response.json({ ok: false, error: "Unknown upload kind." }, { status: 400 });
}
