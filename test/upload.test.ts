import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RouterContextProvider } from "react-router";
import { cloudflareContext } from "~/lib/context.server";
import { applyMigrations } from "./helpers/d1";

// The editor's upload endpoint (app/routes/admin.upload.ts): images go to BLOG_IMAGES, audio to
// MEDIA, under a folder named for the post, an image with its media library row; anything else is refused with the right status.
const e = env as unknown as Env;
let action: typeof import("~/routes/admin.upload").action;

function upload(fields: Record<string, string | File>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  const context = new RouterContextProvider();
  context.set(cloudflareContext, { env: e, ctx: {} as ExecutionContext });
  const request = new Request("https://germomics.com/admin/upload", { method: "POST", body: form });
  return action({ request, context, params: {} } as unknown as Parameters<typeof action>[0]) as Promise<Response>;
}
const file = (name: string, type: string, size = 4) => new File([new Uint8Array(size)], name, { type });
/** A file that starts with the PNG signature, so its bytes match its type. */
const png = (name: string, size = 8) => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), new Uint8Array(size - 8)], name, { type: "image/png" });

beforeAll(async () => {
  await applyMigrations(e.DB);
  ({ action } = await import("~/routes/admin.upload"));
}, 120_000);

beforeEach(async () => {
  for (const bucket of [e.BLOG_IMAGES, e.MEDIA]) {
    const listed = await bucket.list();
    if (listed.objects.length) await bucket.delete(listed.objects.map((o) => o.key));
  }
});

describe("admin upload", () => {
  it("stores an image under the post's folder and returns its public URL", async () => {
    const res = await upload({ kind: "image", postId: "12", file: png("My Pic.png") });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, any>;
    expect(body).toMatchObject({ ok: true, contentType: "image/png", name: "My Pic.png", size: 8 });
    expect(body.url).toMatch(/^\/media\/posts\/12\/\d+-My_Pic\.png$/);
    const key = body.url.replace("/media/", "");
    expect((await e.BLOG_IMAGES.head(key))?.httpMetadata?.contentType).toBe("image/png");
    // And into the media library, where Carrel's media page lists it.
    expect(await e.DB.prepare("SELECT filename, content_type, bytes FROM media WHERE key = ?").bind(key).first()).toEqual({ filename: "My Pic.png", content_type: "image/png", bytes: 8 });
  });

  it("stores audio in the media bucket with its type, and cleans the post id", async () => {
    const res = await upload({ kind: "audio", postId: "../../etc", file: file("ep.mp3", "audio/mpeg", 10) });
    const body = (await res.json()) as Record<string, any>;
    expect(body).toMatchObject({ ok: true, size: 10, contentType: "audio/mpeg" });
    expect(body.url).toMatch(/^https:\/\/media\.germomics\.com\/episodes\/etc\/\d+-ep\.mp3$/);
    const key = body.url.replace("https://media.germomics.com/", "");
    expect((await e.MEDIA.head(key))?.httpMetadata?.contentType).toBe("audio/mpeg");
    const misc = (await (await upload({ kind: "audio", postId: "///", file: file("a.mp3", "audio/mpeg") })).json()) as Record<string, any>;
    expect(misc.url).toContain("/episodes/misc/");
  });

  it("refuses no file, an empty file, an SVG or bytes that are not their type, an oversized image, and an unknown kind", async () => {
    const expectRefusal = async (res: Response, status: number, error?: string) => {
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ ok: false, error: error ?? expect.any(String) });
    };
    await expectRefusal(await upload({ kind: "image" }), 400, "No file received.");
    await expectRefusal(await upload({ kind: "image", file: file("e.png", "image/png", 0) }), 400, "No file received.");
    await expectRefusal(await upload({ kind: "image", file: file("x.svg", "image/svg+xml") }), 415);
    await expectRefusal(await upload({ kind: "image", file: file("t.png", "image/png") }), 415);
    await expectRefusal(await upload({ kind: "image", file: png("big.png", 25 * 1024 * 1024 + 1) }), 413, "Image exceeds 25 MB.");
    await expectRefusal(await upload({ kind: "video", file: file("v.mp4", "video/mp4") }), 400, "Unknown upload kind.");
    expect((await e.BLOG_IMAGES.list()).objects).toHaveLength(0);
    expect((await e.MEDIA.list()).objects).toHaveLength(0);
  });

  it("accepts an image of exactly 25 MB", async () => {
    const res = await upload({ kind: "image", file: png("edge.png", 25 * 1024 * 1024) });
    expect(res.status).toBe(200);
  }, 20_000);
});
