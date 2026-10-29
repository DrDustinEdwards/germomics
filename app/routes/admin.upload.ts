// Admin upload endpoint — drag-drop / file-picker target for the editor's dual-input fields.
// Resource route (action only) under the admin.* gate (admin.tsx middleware runs first), so it
// is never publicly writable. Streams the file straight into R2 via the native binding and
// returns JSON the client uses to fill the field. Images → images.germomics.com (BLOG_IMAGES), with
// their width and height as custom metadata so pages can offer resized copies from /media;
// audio → media.germomics.com (germomics-audio).
import type { Route } from "./+types/admin.upload";
import { getEnv } from "~/lib/context.server";
import { uploadAudio, uploadImage, buildKey } from "~/lib/r2.server";
import { imageMetadata } from "~/lib/images.server";

const MAX_IMAGE = 25 * 1024 * 1024; // 25 MB
// Cloudflare refuses a request body over 100 MB on the Free and Pro plans before the Worker sees it,
// so a larger cap only promised uploads that could never arrive (Grok audit 2026-10-21, GE-9).
// An hour of 128 kbps MP3 is about 58 MB.
const MAX_AUDIO = 100 * 1024 * 1024; // 100 MB

export async function action({ request, context }: Route.ActionArgs) {
  const env = getEnv(context);
  const form = await request.formData();
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
    if (!file.type.startsWith("image/")) {
      return Response.json({ ok: false, error: "Not an image file." }, { status: 415 });
    }
    const key = buildKey(`posts/${postId}`, file.name);
    const bytes = await file.arrayBuffer();
    const url = await uploadImage(env, key, bytes, file.type, await imageMetadata(env, bytes));
    return Response.json({ ok: true, url, contentType: file.type, name: file.name, size: file.size });
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
