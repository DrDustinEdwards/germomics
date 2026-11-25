// Admin upload endpoint (action only, behind the admin.tsx gate). Images go to BLOG_IMAGES through site-api's
// prepareUpload (width and height as custom metadata, plus a media library row); audio goes to germomics-audio.
// The body is the raw file; kind, postId and name ride in the query string. Audio is streamed to R2 at its declared
// length and never held in memory: parsed as a form, a 100 MB episode is held about three times, past a Worker's
// 128 MB. An image is read whole, to its 25 MB cap, because prepareUpload checks and converts its bytes.
import type { Route } from "./+types/admin.upload";
import { getEnv } from "@dustinedwards/site-runtime/context";
import { putAudio, putImage, buildKey } from "~/lib/r2.server";
import { RefusedError, checkUpload, prepareUpload } from "@dustinedwards/site-api";
import { logEvent } from "@dustinedwards/site-runtime/log";
import { pictureLimits, PICTURE_RESIZE } from "@dustinedwards/site-api";
import { recordUpload, sizeMetadata } from "~/lib/media/store.server";
import { readCappedBytes } from "@dustinedwards/site-runtime/body";

const MAX_IMAGE = 25 * 1024 * 1024; // 25 MB
// Cloudflare refuses a body over 100 MB on Free and Pro before the Worker sees it, so a larger cap promises nothing.
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
    // Counted as it arrives, so a body longer than its Content-Length is refused.
    const bytes = await readCappedBytes(request, MAX_IMAGE);
    if (!bytes) return Response.json({ ok: false, error: "Image exceeds 25 MB." }, { status: 413 });
    if (bytes.byteLength === 0)
      return Response.json({ ok: false, error: "No file received." }, { status: 400 });
    // prepareUpload refuses an SVG or unknown type, converts HEIC to JPEG, strips location and shrinks camera-sized pictures.
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
    // A row that could not be written is made by the next backfill; the address works either way.
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

  // R2 takes a stream only at a known length: refuse a missing or over-cap Content-Length; FixedLengthStream fails on a mismatch.
  if (!Number.isSafeInteger(length) || length < 0) {
    return Response.json(
      { ok: false, error: "The upload needs a Content-Length." },
      { status: 411 },
    );
  }
  if (length > MAX_AUDIO)
    return Response.json({ ok: false, error: "Audio exceeds 100 MB." }, { status: 413 });
  const key = buildKey(`episodes/${postId}`, name);
  // Podcast apps play MP3 and M4A, and the episode is served from a public host: the type stored is the one its extension
  // names and its bytes carry (site-api's checkUpload), never the one the browser sent.
  const ext = /\.(mp3|m4a)$/i.exec(name)?.[1]?.toLowerCase();
  const ct = ext === "m4a" ? "audio/mp4" : "audio/mpeg";
  // Every audio signature is in the first 12 bytes, and a browser's first chunk is far longer: a shorter one is refused.
  const reader = request.body.getReader();
  const { value: head } = await reader.read();
  if (!ext || !head || checkUpload(ct, head, { maxBytes: MAX_AUDIO, types: [ct] })) {
    await reader.cancel();
    return Response.json({ ok: false, error: "The file must be audio." }, { status: 415 });
  }
  const body = new ReadableStream<Uint8Array>({
    start: (out) => out.enqueue(head),
    async pull(out) {
      const { done, value } = await reader.read();
      if (done) out.close();
      else out.enqueue(value);
    },
  });
  const { url: stored, size } = await putAudio(
    env,
    key,
    body.pipeThrough(new FixedLengthStream(length)),
    ct,
  );
  return Response.json({ ok: true, url: stored, size, contentType: ct, name });
}
