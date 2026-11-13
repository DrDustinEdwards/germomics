// Admin upload endpoint — drag-drop / file-picker target for the editor's dual-input fields.
// Resource route (action only) under the admin.* gate (admin.tsx middleware runs first), so it
// is never publicly writable. Writes the file into R2 via the native binding and returns JSON the
// client uses to fill the field. Images → BLOG_IMAGES, at /media/<key>, through site-api's
// prepareUpload, with their width and height as custom metadata so pages can offer resized copies
// from /media, and a row in the media library; audio → media.germomics.com (germomics-audio).
//
// The body is the file itself (UploadDropzone sends it raw, its type as Content-Type), and kind, postId and name ride in
// the query string. Audio is streamed straight to R2 at its declared length and never held in memory: read as a form, a
// 100 MB episode was held about three times over (the body, the parsed form, the file's ArrayBuffer), past a Worker's
// 128 MB. An image is read whole, to its 25 MB cap, because prepareUpload checks and converts its bytes.
import type { Route } from "./+types/admin.upload";
import { getEnv } from "@dustinedwards/site-runtime/context";
import { putAudio, putImage, buildKey } from "~/lib/r2.server";
import { RefusedError, prepareUpload } from "@dustinedwards/site-api";
import { logEvent } from "@dustinedwards/site-runtime/log";
import { pictureLimits, PICTURE_RESIZE } from "@dustinedwards/site-api";
import { recordUpload, sizeMetadata } from "~/lib/media/store.server";
import { readCappedBytes } from "@dustinedwards/site-runtime/body";

const MAX_IMAGE = 25 * 1024 * 1024; // 25 MB
// Cloudflare refuses a request body over 100 MB on the Free and Pro plans before the Worker sees it,
// so a larger cap only promised uploads that could never arrive (Grok audit 2026-10-21, GE-9).
// An hour of 128 kbps MP3 is about 58 MB.
const MAX_AUDIO = 100 * 1024 * 1024; // 100 MB

export async function action({ request, context }: Route.ActionArgs) {
  const env = getEnv(context);
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "";
  const postId = (url.searchParams.get("postId") ?? "misc").replace(/[^\w-]/g, "") || "misc";
  const name = url.searchParams.get("name") || "upload";
  const type = request.headers.get("Content-Type") ?? "";
  const declared = request.headers.get("Content-Length");
  const length = declared === null ? Number.NaN : Number(declared);

  if (kind !== "image" && kind !== "audio") {
    return Response.json({ ok: false, error: "Unknown upload kind." }, { status: 400 });
  }
  if (!request.body || length === 0) {
    return Response.json({ ok: false, error: "No file received." }, { status: 400 });
  }

  if (kind === "image") {
    if (length > MAX_IMAGE)
      return Response.json({ ok: false, error: "Image exceeds 25 MB." }, { status: 413 });
    // Counted as it arrives, so a body longer than its Content-Length says is refused too.
    const bytes = await readCappedBytes(request, MAX_IMAGE);
    if (!bytes) return Response.json({ ok: false, error: "Image exceeds 25 MB." }, { status: 413 });
    if (bytes.byteLength === 0)
      return Response.json({ ok: false, error: "No file received." }, { status: 400 });
    // The bytes are checked against the type (an SVG or anything unknown is refused), a HEIC becomes a JPEG, a location
    // is taken out and a camera-sized picture shrunk, as Carrel's uploads are.
    let prepared;
    try {
      const input = {
        bytes,
        contentType: type,
        filename: name,
        alt: "",
        changeId: "",
        resize: true,
      };
      prepared = await prepareUpload(env.IMAGES, input, {
        resize: PICTURE_RESIZE,
        limits: pictureLimits(MAX_IMAGE),
      });
    } catch (error) {
      if (error instanceof RefusedError)
        return Response.json({ ok: false, error: error.message }, { status: 415 });
      throw error;
    }
    const key = buildKey(`posts/${postId}`, prepared.filename);
    const stored = await putImage(
      env,
      key,
      prepared.bytes,
      prepared.contentType,
      sizeMetadata(prepared),
    );
    // Into the media library too (Carrel's media page). The image is stored and its address works either way; a row
    // that could not be written is made by the next backfill (POST /admin/media/backfill).
    await recordUpload(env, key, prepared).catch((error) =>
      logEvent("media_record_failed", { key, error }, { level: "error" }),
    );
    return Response.json({
      ok: true,
      url: stored,
      contentType: prepared.contentType,
      name: prepared.filename,
      size: prepared.bytes.byteLength,
    });
  }

  // Audio: R2 takes a stream only at a known length. Without a Content-Length there is none, and over the cap is refused
  // before a byte is read; FixedLengthStream fails the write if the body runs longer or shorter than it said.
  if (!Number.isSafeInteger(length) || length < 0) {
    return Response.json(
      { ok: false, error: "The upload needs a Content-Length." },
      { status: 411 },
    );
  }
  if (length > MAX_AUDIO)
    return Response.json({ ok: false, error: "Audio exceeds 100 MB." }, { status: 413 });
  const key = buildKey(`episodes/${postId}`, name);
  const ct = type || "audio/mpeg";
  const { url: stored, size } = await putAudio(
    env,
    key,
    request.body.pipeThrough(new FixedLengthStream(length)),
    ct,
  );
  return Response.json({ ok: true, url: stored, size, contentType: ct, name });
}
