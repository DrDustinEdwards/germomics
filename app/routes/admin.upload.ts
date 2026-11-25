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

// The type each extension an episode may carry is stored and served as: the key keeps the file's own, it is served
// from a public host, and the bytes must carry that type's signature (site-api's checkUpload). The browser's type is never stored.
const AUDIO_TYPES: Record<string, string> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  aac: "audio/aac",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  flac: "audio/flac",
};
const AUDIO_LIMITS = { maxBytes: MAX_AUDIO, types: [...new Set(Object.values(AUDIO_TYPES))] };
// Every audio signature is in the first 12 bytes; 64 leaves room.
const AUDIO_HEAD = 64;

/** The stream's first `size` bytes (fewer if it is shorter), and a stream of the whole body, those bytes included. */
async function splitHead(body: ReadableStream<Uint8Array>, size: number) {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let read = 0;
  while (read < size) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    read += value.byteLength;
  }
  const head = new Uint8Array(read);
  chunks.reduce((at, chunk) => (head.set(chunk, at), at + chunk.byteLength), 0);
  const whole = new ReadableStream<Uint8Array>({
    start(controller) {
      if (read) controller.enqueue(head);
    },
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    cancel: (reason) => reader.cancel(reason),
  });
  return { head: head.subarray(0, size), whole };
}

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
  const ct = AUDIO_TYPES[/\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? ""];
  const notAudio = Response.json({ ok: false, error: "The file must be audio." }, { status: 415 });
  if (!ct) return notAudio;
  const { head, whole } = await splitHead(request.body, AUDIO_HEAD);
  if (checkUpload(ct, head, AUDIO_LIMITS)) {
    await whole.cancel();
    return notAudio;
  }
  const { url: stored, size } = await putAudio(
    env,
    key,
    whole.pipeThrough(new FixedLengthStream(length)),
    ct,
  );
  return Response.json({ ok: true, url: stored, size, contentType: ct, name });
}
