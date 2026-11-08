import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  MediaInUseError,
  NotFoundError,
  RefusedError,
  VersionConflictError,
  type MediaAdapter,
} from "@dustinedwards/site-api";
import { createCarrelAdapter } from "~/lib/carrel/adapter.server";
import { imageSet } from "~/lib/images.server";
import { backfillMedia, continueMediaBackfill } from "~/lib/media/backfill.server";
import { resetDb } from "@dustinedwards/devkit/d1";
import { applyMigrations } from "./helpers/d1";

// The media group (app/lib/carrel/media.server.ts) as site-api calls it, over the real migrations, the BLOG_IMAGES and
// BACKUPS buckets, and a stand-in Images binding and Workers AI. carrel.test.ts runs the same group through the HTTP
// handler and site-api's conformance suite.
const e = env as unknown as Env;
const ORIGIN = "/media";

/** A PNG of the given size, with tEXt chunks (the embedded metadata) and a tail that makes each one's bytes its own. */
const ascii = (text: string) => [...new TextEncoder().encode(text)];

function png(
  width: number,
  height: number,
  text: Record<string, string> = {},
  tail = 0,
): Uint8Array<ArrayBuffer> {
  const chunk = (type: string, data: number[]) => {
    const len = data.length;
    return [
      len >>> 24,
      (len >>> 16) & 255,
      (len >>> 8) & 255,
      len & 255,
      ...ascii(type),
      ...data,
      0,
      0,
      0,
      0,
    ];
  };
  const be = (n: number) => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const texts = Object.entries(text).flatMap(([k, v]) =>
    chunk("tEXt", [...ascii(k), 0, ...ascii(v)]),
  );
  return new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...chunk("IHDR", [...be(width), ...be(height), 8, 6, 0, 0, 0]),
    ...texts,
    ...chunk("IDAT", [tail]),
    ...chunk("IEND", []),
  ]);
}
const sizeOf = (b: Uint8Array) => {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { width: v.getUint32(16), height: v.getUint32(20) };
};

/** The Images binding as far as the site uses it: info reads the PNG's size, and an edit answers a PNG of the new size. */
let edits: Array<Record<string, unknown>> = [];
const images = {
  async info(stream: ReadableStream) {
    return {
      ...sizeOf(new Uint8Array(await new Response(stream).arrayBuffer())),
      format: "image/png",
      fileSize: 0,
    };
  },
  input(stream: ReadableStream) {
    return {
      transform(options: Record<string, unknown>) {
        return {
          async output(out: { format: string }) {
            edits.push({ ...options, format: out.format });
            const { width, height } = sizeOf(
              new Uint8Array(await new Response(stream).arrayBuffer()),
            );
            const turned = options.rotate === 90 || options.rotate === 270;
            let [w, h] = turned ? [height, width] : [width, height];
            const edge = options.width as number | undefined;
            if (edge && Math.max(w, h) > edge)
              [w, h] = [
                Math.round((w * edge) / Math.max(w, h)),
                Math.round((h * edge) / Math.max(w, h)),
              ];
            return { response: () => new Response(png(w, h, {}, edits.length)) };
          },
        };
      },
    };
  },
};
let aiCalls = 0;
// Anthropic's answer, as structured outputs return it: one JSON text block (site-api 0.32 calls Claude straight at Anthropic).
const anthropic = async () => (
  aiCalls++,
  new Response(
    JSON.stringify({
      id: "msg_1",
      type: "message",
      role: "assistant",
      stop_reason: "end_turn",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            alt: "A rod-shaped bacterium under a microscope.",
            tags: ["bacterium", "Microscope", "rod shaped"],
          }),
        },
      ],
      usage: { input_tokens: 10, output_tokens: 20 },
    }),
    { headers: { "content-type": "application/json" } },
  )
);

let logged: Record<string, unknown>[] = [];
let media: MediaAdapter;
const build = (extra: Partial<Env> = {}) =>
  createCarrelAdapter(
    { ...e, IMAGES: images, ANTHROPIC_API_KEY: "sk-ant-test", ...extra } as unknown as Env,
    (x) => logged.push(x),
  ).media!;
const row = (key: string) =>
  e.DB.prepare("SELECT * FROM media WHERE key = ?").bind(key).first<Record<string, unknown>>();
const upload = (bytes = png(800, 600), more: Partial<Parameters<MediaAdapter["upload"]>[0]> = {}) =>
  media.upload({
    bytes,
    contentType: "image/png",
    filename: "Vibrio.png",
    alt: "",
    changeId: "chg_u",
    ...more,
  });
const usePost = (slug: string, html: string) =>
  e.DB.prepare(
    "INSERT INTO posts (kind, title, slug, body, status) VALUES ('article', ?, ?, ?, 'draft')",
  )
    .bind(slug, slug, html)
    .run();

beforeAll(() => applyMigrations(e.DB));

beforeEach(async () => {
  logged = [];
  edits = [];
  aiCalls = 0;
  globalThis.fetch = anthropic as unknown as typeof fetch;
  media = build();
  await resetDb(e.DB);
  for (const bucket of [e.BLOG_IMAGES, e.BACKUPS]) {
    const listed = await bucket.list();
    if (listed.objects.length) await bucket.delete(listed.objects.map((o) => o.key));
  }
});

describe("an upload", () => {
  it("stores the object and its row, fills empty fields from the picture's own metadata, and logs the change", async () => {
    const bytes = png(800, 600, {
      Author: "Dustin Edwards",
      Copyright: "CC BY 4.0",
      Description: "Vibrio cholerae",
    });
    const item = await upload(bytes, { alt: "Curved rods" });
    expect(item).toMatchObject({
      width: 800,
      height: 600,
      alt: "Curved rods",
      credit: "Dustin Edwards",
      license: "CC BY 4.0",
      caption: "Vibrio cholerae",
      usedCount: 0,
      version: "r0",
      tags: [],
      trashedAt: null,
      embedded: ["credit", "license", "caption"],
    });
    expect(item.id).toMatch(/^carrel\/\d+-Vibrio\.png$/);
    expect(item.url).toBe(`/media/${item.id}`);
    // The size rides on the object, where every page reads it.
    expect((await e.BLOG_IMAGES.head(item.id))!.customMetadata).toMatchObject({
      width: "800",
      height: "600",
    });
    expect(String((await row(item.id))!.sha256)).toMatch(/^[0-9a-f]{64}$/);
    // The placeholder and main color prepareUpload made, kept on the row.
    expect(item.placeholder).toMatch(/^data:image\//);
    expect(logged).toEqual([
      { event: "carrel.media.upload", id: item.id, version: "r0", changeId: "chg_u" },
    ]);
  });

  it("shrinks a picture over the longest edge, keeping the original in the history and in BACKUPS", async () => {
    const big = png(8192, 4096);
    const item = await upload(big, { resize: true });
    expect(item).toMatchObject({
      width: 2560,
      height: 1280,
      resizedFrom: { width: 8192, height: 4096, bytes: big.byteLength },
    });
    const history = (await media.history!(item.id))!;
    expect(history.map((r) => [r.reason, r.width, r.current])).toEqual([
      ["resize", 2560, true],
      ["upload", 8192, false],
    ]);
    expect(await media.findByHash!(String((await row(item.id))!.sha256))).toMatchObject({
      id: item.id,
    });
    // The same original sent again is the same file.
    const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", big))]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    expect(await media.findByHash!(digest)).toMatchObject({ id: item.id });
    const reverted = await media.revert!(item.id, {
      to: history[1]!.rev,
      expectedVersion: item.version!,
      changeId: "c",
    });
    expect(reverted.item).toMatchObject({ width: 8192, height: 4096, bytes: big.byteLength });
    expect(new Uint8Array(await (await e.BLOG_IMAGES.get(item.id))!.arrayBuffer())).toEqual(big);
    // Kept as it was: a picture already in BLOG_IMAGES is shrunk in place by the pass, and its old bytes kept again.
    const pass = await media.shrink!(item.id, {
      expectedVersion: reverted.item.version!,
      changeId: "c",
    });
    expect(pass).toMatchObject({ resized: true, item: { width: 2560, height: 1280 } });
    expect(
      await media.shrink!(item.id, { expectedVersion: pass.item.version!, changeId: "c" }),
    ).toMatchObject({ resized: false });
    // Copies are kept by their bytes' hash (site-api 0.24), so the reverted bytes, the original again, are one copy.
    expect((await e.BACKUPS.list({ prefix: "media/revisions/" })).objects.length).toBe(2);
  });
});

describe("the library", () => {
  it("names every place that uses a file, refuses its delete, and deletes one nothing uses", async () => {
    const item = await upload();
    const key = item.id;
    await usePost("body", `<figure><img src="${ORIGIN}/${key}" width="400" height="300"></figure>`);
    await usePost("lookalike", `<img src="${ORIGIN}/${key}x">`);
    await e.DB.prepare("INSERT INTO people (name, slug, photo) VALUES ('Guest', 'guest', ?)")
      .bind(`https://germomics.com/media/${key}?w=64`)
      .run();
    await e.DB.prepare(
      "INSERT INTO scheduled_updates (content_id, source, publish_at, change_id, scheduled_at) VALUES ('later', ?, '2030-01-01T00:00:00.000Z', 'c', '2026-01-01T00:00:00.000Z')",
    )
      .bind(`![x](${ORIGIN}/${key})`)
      .run();
    const got = (await media.get(key))!;
    expect(got.usedBy).toEqual([
      { type: "post", id: "body", title: "body", detail: "body" },
      { type: "scheduled update", id: "later", title: "later", detail: "scheduled update" },
      { type: "person", id: "guest", title: "Guest", detail: "photo" },
    ]);
    expect(got.usedCount).toBe(3);
    await expect(media.delete(key, { changeId: "c" })).rejects.toBeInstanceOf(MediaInUseError);
    expect(await row(key)).not.toBeNull();

    // The show's default artwork is named in code, so it is never unused.
    await e.BLOG_IMAGES.put("brand/germomics-artwork-1400.jpg", png(10, 10));
    await backfillMedia(e);
    await expect(
      media.delete("brand/germomics-artwork-1400.jpg", { changeId: "c" }),
    ).rejects.toBeInstanceOf(MediaInUseError);

    const loose = await upload(png(20, 20, {}, 9));
    const cursor = (await media.list({ limit: 1 })).changeCursor!;
    await media.delete(loose.id, { changeId: "chg_d" });
    expect(await e.BLOG_IMAGES.head(loose.id)).toBeNull();
    expect(await row(loose.id)).toBeNull();
    expect(await media.changes!({ since: cursor, limit: 10 })).toMatchObject({
      items: [],
      removed: [loose.id],
      more: false,
    });
    await expect(media.delete(loose.id, { changeId: "c" })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("the writes", () => {
  it("each lands only at the version it names and moves it, even twice in one second", async () => {
    const item = await upload();
    const alt = await media.setAlt!(item.id, {
      alt: "Rods",
      expectedVersion: item.version!,
      changeId: "c1",
    });
    const caption = await media.setCaption!(item.id, {
      caption: "Cap",
      expectedVersion: alt.version,
      changeId: "c2",
    });
    const credit = await media.setCredit!(item.id, {
      credit: "CDC",
      license: "Public domain",
      sourceUrl: "https://phil.example.com/1",
      licenseExpires: "2020-01-01",
      expectedVersion: caption.version,
      changeId: "c3",
    });
    expect(new Set([item.version, alt.version, caption.version, credit.version]).size).toBe(4);
    const stale = await media.setAlt!(item.id, {
      alt: "Lost",
      expectedVersion: alt.version,
      changeId: "c",
    }).catch((x) => x);
    expect(stale).toBeInstanceOf(VersionConflictError);
    expect(stale.currentVersion).toBe(credit.version);
    expect(await media.get(item.id)).toMatchObject({
      alt: "Rods",
      caption: "Cap",
      credit: "CDC",
      license: "Public domain",
      licenseExpires: "2020-01-01",
    });
    expect(
      (await media.list({ limit: 10, lens: "license-expired" })).items.map((i) => i.id),
    ).toEqual([item.id]);
    await expect(
      media.setAlt!("carrel/none.png", { alt: "x", expectedVersion: "r0", changeId: "c" }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(logged.map((l) => l.event)).toEqual([
      "carrel.media.upload",
      "carrel.media.alt",
      "carrel.media.caption",
      "carrel.media.credit",
    ]);
  });

  it("keeps a focal point where the crops read it", async () => {
    const item = await upload(png(1600, 900));
    const { version } = await media.setFocus!(item.id, {
      focus: "0.25x0.4",
      expectedVersion: item.version!,
      changeId: "c_f",
    });
    expect(await media.get(item.id)).toMatchObject({ version, focus: "0.25x0.4" });
    expect(Object.values(await imageSet(e, [["cover", item.url]]))[0]!.src).toContain(
      "r=2x1&fp=0.25x0.4",
    );
  });

  it("replaces and turns a picture in place, the old bytes kept, the size and point following on the object and in the pages", async () => {
    const item = await upload(png(1600, 900));
    const focused = await media.setFocus!(item.id, {
      focus: "0.1x0.2",
      expectedVersion: item.version!,
      changeId: "c",
    });
    const turned = await media.transform!(item.id, {
      op: "rotate-90",
      asNewFile: false,
      expectedVersion: focused.version,
      changeId: "c_t",
    });
    expect(turned.item).toMatchObject({ id: item.id, width: 900, height: 1600, focus: "0.8x0.1" });
    expect((await e.BLOG_IMAGES.head(item.id))!.customMetadata).toMatchObject({
      width: "900",
      height: "1600",
      focus: "0.8x0.1",
    });
    // site-api 0.24: a replace names the file by the new upload.
    const replaced = await media.replace!(item.id, {
      bytes: png(640, 480, {}, 7),
      contentType: "image/png",
      filename: "n.png",
      expectedVersion: turned.item.version!,
      changeId: "c_r",
    });
    expect(replaced.item).toMatchObject({
      width: 640,
      height: 480,
      focus: null,
      filename: "n.png",
    });
    expect((await media.history!(item.id))!.map((r) => r.reason)).toEqual([
      "replace",
      "transform",
      "upload",
    ]);

    // No page holds the size of its own (replaceKeepsSize is off): a converted post that shows the picture is rendered
    // again after a quarter turn, so its figure has the new size and its size URLs the new bytes' version (v=), and no
    // browser keeps the year-cached old picture.
    await e.DB.prepare(
      "INSERT INTO posts (kind, title, slug, body, status, render_version, body_html) VALUES ('article', 'md', 'md', ?, 'draft', '0', '')",
    )
      .bind(`![A vibrio](${item.url})`)
      .run();
    expect(
      (
        await media.transform!(item.id, {
          op: "rotate-270",
          asNewFile: false,
          expectedVersion: replaced.item.version!,
          changeId: "c",
        })
      ).item,
    ).toMatchObject({ id: item.id, width: 480, height: 640 });
    const { sha256 } = (await e.DB.prepare("SELECT sha256 FROM media WHERE key = ?")
      .bind(item.id)
      .first<{ sha256: string }>())!;
    const { body_html } = (await e.DB.prepare(
      "SELECT body_html FROM posts WHERE slug = 'md'",
    ).first<{ body_html: string }>())!;
    expect(body_html).toContain(`v=${sha256.slice(0, 12)}`);
    expect(body_html).toMatch(/width="\d+" height="\d+"/);
    expect((await e.BLOG_IMAGES.head(item.id))!.customMetadata).toMatchObject({
      width: "480",
      height: "640",
    });
  });

  it("reverts to a copy kept before site-api 0.24, under media/revisions/<time>/<key>", async () => {
    const item = await upload(png(800, 600));
    const old = png(400, 300, {}, 5);
    const copy = `media/revisions/2026-01-01T00:00:00.000Z/${item.id}`;
    await e.BACKUPS.put(copy, old);
    const { id } = (await e.DB.prepare("SELECT id FROM media_revisions WHERE media_key = ?")
      .bind(item.id)
      .first<{ id: number }>())!;
    await e.DB.prepare(
      "UPDATE media_revisions SET backup_key = ?, width = 400, height = 300, bytes = ? WHERE id = ?",
    )
      .bind(copy, old.byteLength, id)
      .run();
    await e.DB.prepare(
      "INSERT INTO media_revisions (media_key, at, bytes, width, height, reason, sha256) VALUES (?, '2026-01-02 00:00:00', 1, 800, 600, 'replace', NULL)",
    )
      .bind(item.id)
      .run();
    const reverted = await media.revert!(item.id, {
      to: String(id),
      expectedVersion: item.version!,
      changeId: "c",
    });
    expect(reverted.item).toMatchObject({ width: 400, height: 300, bytes: old.byteLength });
    expect(new Uint8Array(await (await e.BLOG_IMAGES.get(item.id))!.arrayBuffer())).toEqual(old);
  });

  it("answers what changed since a cursor, each file once and as it is now", async () => {
    const a = await upload();
    const cursor = (await media.list({ limit: 1 })).changeCursor!;
    const b = await upload(png(10, 10, {}, 3));
    const alt = await media.setAlt!(a.id, {
      alt: "One",
      expectedVersion: a.version!,
      changeId: "c",
    });
    await media.setAlt!(a.id, { alt: "Two", expectedVersion: alt.version, changeId: "c" });
    const page = await media.changes!({ since: cursor, limit: 1 });
    expect(page).toMatchObject({ items: [{ id: b.id }], more: true });
    expect(await media.changes!({ since: page.cursor, limit: 10 })).toMatchObject({
      items: [{ id: a.id, alt: "Two" }],
      removed: [],
      more: false,
    });
    await expect(media.changes!({ since: "999999", limit: 10 })).rejects.toBeInstanceOf(
      RefusedError,
    );
  });
});

describe("suggestions", () => {
  it("answers the model's tags and alt without writing, and refuses without a model", async () => {
    const item = await upload();
    expect(await media.suggest!(item.id)).toEqual({
      alt: "A rod-shaped bacterium under a microscope.",
      tags: ["bacterium", "Microscope", "rod shaped"],
      model: "claude-haiku-5-5",
      usage: { input: 10, output: 20, cacheRead: 0, cacheWrite: 0 },
    });
    expect(aiCalls).toBe(1);
    expect((await row(item.id))!).toMatchObject({ alt: "", tags: "[]", rev: 0 });
    expect(await media.suggest!("carrel/none.png")).toBeNull();
    await expect(
      build({ ANTHROPIC_API_KEY: undefined } as Partial<Env>).suggest!(item.id),
    ).rejects.toBeInstanceOf(RefusedError);
  });
});

describe("the backfill", () => {
  it("makes a row for each object already in the bucket from what it says, once, and changes no object", async () => {
    await e.BLOG_IMAGES.put("ep-1/vibrio-400.webp", png(400, 300), {
      httpMetadata: { contentType: "image/webp" },
      customMetadata: { alt: "Old alt", filename: "vibrio.webp", focus: "0.5x0.5" },
    });
    await e.BLOG_IMAGES.put("posts/1/pump.png", png(1200, 800, {}, 1), {
      httpMetadata: { contentType: "image/png" },
      customMetadata: { width: "1200", height: "800" },
    });
    await e.DB.prepare(
      "INSERT INTO media_captions (media_key, caption) VALUES ('posts/1/pump.png', 'The pump')",
    ).run();
    const before = (await e.BLOG_IMAGES.head("ep-1/vibrio-400.webp"))!.etag;

    const first = await backfillMedia({ ...e, IMAGES: images } as unknown as Env, { limit: 1 });
    expect(first).toMatchObject({ scanned: 1, added: ["ep-1/vibrio-400.webp"], done: false });
    const rest = await backfillMedia({ ...e, IMAGES: images } as unknown as Env, {
      cursor: first.cursor,
    });
    expect(rest).toMatchObject({ added: ["posts/1/pump.png"], done: true });
    expect((await backfillMedia(e)).added).toEqual([]);

    expect(await media.get("ep-1/vibrio-400.webp")).toMatchObject({
      alt: "Old alt",
      filename: "vibrio.webp",
      focus: "0.5x0.5",
      width: 400,
      height: 300,
      contentType: "image/webp",
      version: "r0",
    });
    expect(await media.get("posts/1/pump.png")).toMatchObject({
      caption: "The pump",
      width: 1200,
      height: 800,
    });
    expect((await e.BLOG_IMAGES.head("ep-1/vibrio-400.webp"))!.etag).toBe(before);

    // A key from before Carrel that is not a MediaId keeps its row and address, and stays out of the library.
    const cursor = (await media.list({ limit: 1 })).changeCursor!;
    await e.BLOG_IMAGES.put("old pics/a b.png", png(5, 5, {}, 3), {
      httpMetadata: { contentType: "image/png" },
    });
    expect((await backfillMedia({ ...e, IMAGES: images } as unknown as Env)).added).toEqual([
      "old pics/a b.png",
    ]);
    expect((await media.list({ limit: 50 })).items.map((i) => i.id)).not.toContain(
      "old pics/a b.png",
    );
    expect(await media.changes!({ since: cursor, limit: 10 })).toMatchObject({
      items: [],
      removed: [],
    });

    // The cron walks the bucket once on its own, then stops.
    await e.BLOG_IMAGES.put("posts/2/late.png", png(5, 5, {}, 2));
    await continueMediaBackfill({ ...e, IMAGES: images } as unknown as Env);
    expect(await media.get("posts/2/late.png")).toMatchObject({ width: 5, height: 5 });
    expect(await e.APP_KV.get("media:backfill")).toBe("done");
  });
});
