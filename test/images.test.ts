import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import { RouterContextProvider } from "react-router";
import { cloudflareContext } from "~/lib/context.server";
import { imageSet, responsiveBody } from "~/lib/images.server";

// Responsive images (app/lib/images.ts): a published season 1 figure becomes AVIF and WebP sizes
// from /media, and /media serves BLOG_IMAGES. The widths, formats and refusals are site-runtime's
// and tested there; this is the site's half, which no other test reaches.
const e = env as unknown as Env;
const IMG = "https://images.germomics.com";
const KEY = "a-sky-full-of-sars/coronavirus-795.webp";
let loader: typeof import("~/routes/media.$").loader;

function media(path: string) {
  const context = new RouterContextProvider();
  context.set(cloudflareContext, { env: e, ctx: {} as ExecutionContext });
  const request = new Request(`https://germomics.com/media/${path}`);
  return loader({ request, context, params: { "*": path.split("?")[0] } } as unknown as Parameters<typeof loader>[0]) as Promise<Response>;
}

beforeAll(async () => {
  ({ loader } = await import("~/routes/media.$"));
  await e.BLOG_IMAGES.put(KEY, new Uint8Array([1, 2, 3]), { httpMetadata: { contentType: "image/webp" } });
}, 120_000);

describe("a body figure", () => {
  it("becomes a picture of /media sizes, read from the pre-made file's name and the figure's shape", async () => {
    const html =
      `<figure><img src="${IMG}/${KEY}" srcset="${IMG}/a-sky-full-of-sars/coronavirus-400.webp 400w" sizes="400px" alt="Coronavirus" width="400" height="300" loading="lazy"><figcaption>C</figcaption></figure>` +
      `<figure><img src="${IMG}/missing.webp" alt="Gone" width="400" height="300"></figure>`;
    const out = await responsiveBody(e, html);
    expect(out).toContain('<source type="image/avif" srcset="/media/a-sky-full-of-sars/coronavirus-795.webp?w=400&amp;f=avif 400w, ');
    expect(out).toContain('src="/media/a-sky-full-of-sars/coronavirus-795.webp?w=400"');
    expect(out).toContain('width="400" height="300" alt="Coronavirus"');
    // Wider than the 795px original is never offered.
    expect(out).not.toContain("w=800");
    // A file the bucket does not hold is left exactly as it was.
    expect(out).toContain(`<img src="${IMG}/missing.webp" alt="Gone" width="400" height="300">`);
  });
});

describe("a cover", () => {
  it("gets 2:1 crops when its upload recorded a size, and stays the plain original when not", async () => {
    await e.BLOG_IMAGES.put("posts/1/sized.jpg", new Uint8Array([1]), { httpMetadata: { contentType: "image/jpeg" }, customMetadata: { width: "1600", height: "900" } });
    await e.BLOG_IMAGES.put("posts/1/unsized.jpg", new Uint8Array([1]), { httpMetadata: { contentType: "image/jpeg" } });
    const set = await imageSet(e, [["cover", `${IMG}/posts/1/sized.jpg`], ["cover", `${IMG}/posts/1/unsized.jpg`]]);
    expect(Object.keys(set)).toEqual([`cover|${IMG}/posts/1/sized.jpg`]);
    expect(set[`cover|${IMG}/posts/1/sized.jpg`]).toMatchObject({ src: "/media/posts/1/sized.jpg?w=768&r=2x1", width: 768, height: 384 });
  });
});

describe("/media", () => {
  it("serves the original from BLOG_IMAGES and refuses a width outside the set", async () => {
    const original = await media(KEY);
    expect(original.status).toBe(200);
    expect(original.headers.get("content-type")).toBe("image/webp");
    expect((await media(`${KEY}?w=401`)).status).toBe(400);
    expect((await media("nope.webp")).status).toBe(404);
  });
});
