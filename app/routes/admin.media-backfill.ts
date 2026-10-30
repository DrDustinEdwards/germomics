// POST /admin/media/backfill: one batch of the move of BLOG_IMAGES into the media table (app/lib/media/backfill.server.ts).
// Under the admin.* gate (admin.tsx verifies Cloudflare Access first). A resource route, action only: run it signed in,
// from the browser's console on any /admin page, until it answers done:
//
//   let r = { cursor: null }; do { r = await (await fetch("/admin/media/backfill", { method: "POST",
//     body: new URLSearchParams(r.cursor ? { cursor: r.cursor } : {}) })).json(); console.log(r); } while (!r.done);
//
// It is safe to run again at any time: it only adds the rows that are missing.
import type { Route } from "./+types/admin.media-backfill";
import { getEnv } from "~/lib/context.server";
import { backfillMedia } from "~/lib/media/backfill.server";

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const cursor = String(form.get("cursor") ?? "") || null;
  const result = await backfillMedia(getEnv(context), { cursor });
  return Response.json({ ok: true, ...result, added: result.added.length });
}
