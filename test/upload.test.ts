import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyMigrations } from "./helpers/d1";
import { routeContext } from "./helpers/harness";

// The editor's upload endpoint (app/routes/admin.upload.ts): images go to BLOG_IMAGES, audio to
// MEDIA, under a folder named for the post, an image with its media library row; anything else is refused with the right status.
const e = env as unknown as Env;
let action: typeof import("~/routes/admin.upload").action;

/** The request UploadDropzone sends: the file as the body, its type and length in the headers, the rest in the query. */
function upload(
  { file, ...fields }: { kind?: string; postId?: string; file?: File },
  headers: Record<string, string> = {},
) {
  const query = new URLSearchParams({ ...fields, ...(file ? { name: file.name } : {}) });
  const context = routeContext(e);
  const request = new Request(`https://germomics.com/admin/upload?${query}`, {
    method: "POST",
    body: file ? file.stream() : null,
    headers: {
      ...(file ? { "Content-Type": file.type, "Content-Length": String(file.size) } : {}),
      ...headers,
    },
    ...(file ? { duplex: "half" } : {}),
  } as RequestInit);
  return action({ request, context, params: {} } as unknown as Parameters<
    typeof action
  >[0]) as Promise<Response>;
}
const file = (name: string, type: string, size = 4) =>
  new File([new Uint8Array(size)], name, { type });
/** An MP3 that opens with an ID3 tag, so its bytes match its type. */
const mp3 = (name: string, type = "audio/mpeg", size = 10) =>
  new File([new Uint8Array([0x49, 0x44, 0x33, 4, 0]), new Uint8Array(size - 5)], name, { type });
/** A file that starts with the PNG signature, so its bytes match its type. */
const png = (name: string, size = 8) =>
  new File(
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), new Uint8Array(size - 8)],
    name,
    { type: "image/png" },
  );

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
    const body = (await res.json()) as { url: string; [field: string]: unknown };
    expect(body).toMatchObject({ ok: true, contentType: "image/png", name: "My Pic.png", size: 8 });
    expect(body.url).toMatch(/^\/media\/posts\/12\/\d+-My_Pic\.png$/);
    const key = body.url.replace("/media/", "");
    expect((await e.BLOG_IMAGES.head(key))?.httpMetadata?.contentType).toBe("image/png");
    // And into the media library, where Carrel's media page lists it.
    expect(
      await e.DB.prepare("SELECT filename, content_type, bytes FROM media WHERE key = ?")
        .bind(key)
        .first(),
    ).toEqual({ filename: "My Pic.png", content_type: "image/png", bytes: 8 });
  });

  it("refuses audio whose file name or bytes are not audio, storing nothing", async () => {
    const page = new File(["<html><script>alert(1)</script>"], "ep.mp3", { type: "audio/mpeg" });
    for (const sent of [file("page.html", "audio/mpeg"), page, file("ep.mp3", "audio/mpeg", 10)]) {
      const res = await upload({ kind: "audio", postId: "7", file: sent });
      expect(res.status).toBe(415);
    }
    expect((await e.MEDIA.list()).objects).toEqual([]);
  });

  it("stores audio in the media bucket with its type, and cleans the post id", async () => {
    const res = await upload({
      kind: "audio",
      postId: "../../etc",
      file: mp3("ep.mp3"),
    });
    const body = (await res.json()) as { url: string; [field: string]: unknown };
    expect(body).toMatchObject({ ok: true, size: 10, contentType: "audio/mpeg" });
    expect(body.url).toMatch(/^https:\/\/media\.germomics\.com\/episodes\/etc\/\d+-ep\.mp3$/);
    const key = body.url.replace("https://media.germomics.com/", "");
    expect((await e.MEDIA.head(key))?.httpMetadata?.contentType).toBe("audio/mpeg");
    // The type stored is the one the extension names and the bytes carry, never the one the browser sent.
    const sent = await upload({ kind: "audio", postId: "7", file: mp3("ep.mp3", "text/html") });
    const stored = ((await sent.json()) as { url: string }).url;
    expect(
      (await e.MEDIA.head(stored.replace("https://media.germomics.com/", "")))?.httpMetadata
        ?.contentType,
    ).toBe("audio/mpeg");
    const misc = (await (
      await upload({ kind: "audio", postId: "///", file: mp3("a.mp3") })
    ).json()) as Record<string, unknown>;
    expect(misc.url).toContain("/episodes/misc/");
  });

  it("refuses no file, an empty file, an SVG or bytes that are not their type, an oversized image, and an unknown kind", async () => {
    const expectRefusal = async (res: Response, status: number, error?: string) => {
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ ok: false, error: error ?? expect.any(String) });
    };
    await expectRefusal(await upload({ kind: "image" }), 400, "No file received.");
    await expectRefusal(
      await upload({ kind: "image", file: file("e.png", "image/png", 0) }),
      400,
      "No file received.",
    );
    await expectRefusal(await upload({ kind: "image", file: file("x.svg", "image/svg+xml") }), 415);
    await expectRefusal(await upload({ kind: "image", file: file("t.png", "image/png") }), 415);
    await expectRefusal(
      await upload({ kind: "image", file: png("big.png", 25 * 1024 * 1024 + 1) }),
      413,
      "Image exceeds 25 MB.",
    );
    await expectRefusal(
      await upload({ kind: "video", file: file("v.mp4", "video/mp4") }),
      400,
      "Unknown upload kind.",
    );
    // Audio is streamed at its declared length: none declared, or over the cap, is refused before a byte is read.
    await expectRefusal(
      await upload(
        { kind: "audio", file: file("big.mp3", "audio/mpeg") },
        { "Content-Length": String(100 * 1024 * 1024 + 1) },
      ),
      413,
      "Audio exceeds 100 MB.",
    );
    expect((await e.BLOG_IMAGES.list()).objects).toHaveLength(0);
    expect((await e.MEDIA.list()).objects).toHaveLength(0);
  });

  it("accepts an image of exactly 25 MB", async () => {
    const res = await upload({ kind: "image", file: png("edge.png", 25 * 1024 * 1024) });
    expect(res.status).toBe(200);
  }, 20_000);
});
