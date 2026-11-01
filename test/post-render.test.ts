import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { postBodyFields, RENDER_VERSION, rerenderStale, storedBody } from "~/lib/render.server";
import { demoteHeadings } from "~/lib/seo";
import { applyMigrations } from "./helpers/d1";

// POST RENDER: the Markdown a save stores, the HTML a read serves, and the re-render that keeps them in step
// (app/lib/render.server.ts). Prelum's own output is tested in Prelum; this is the site's half: the media
// library's sizes, the lead figure's width, which rows a read renders, and the page's heading demotion.
const e = env as unknown as Env;
const IMG = "https://images.germomics.com";
const PHOTO = "a-sky-full-of-sars/coronavirus-795.webp";
const LEAD = "antitoxin-togo-please/antitoxin-togo-pls-795.webp";
const BODY = [
  `:::figure{src="${IMG}/${LEAD}" alt="A musher" credit="© Example" width=wide}`,
  "The lead",
  ":::",
  "",
  "## First section",
  "",
  "Some words here.",
  "",
  `:::figure{src="${IMG}/${PHOTO}" alt="Coronavirus" credit="© CDC"}`,
  "Coronavirus",
  ":::",
  "",
  `![Not in the library](${IMG}/missing.webp)`,
  "",
].join("\n");

beforeAll(() => applyMigrations(e.DB));

beforeEach(async () => {
  await e.DB.exec("DELETE FROM posts; DELETE FROM media;");
  for (const key of [PHOTO, LEAD]) {
    await e.DB.prepare("INSERT INTO media (key, content_type, width, height, uploaded_at) VALUES (?, 'image/webp', 795, 597, '2026-01-01')").bind(key).run();
  }
});

describe("a save", () => {
  it("stores the render: figures sized from the media library, the lead at 520px, an unknown image as written", async () => {
    const fields = await postBodyFields(e, BODY, false);
    expect(fields).toMatchObject({ body: BODY, renderVersion: RENDER_VERSION, readingTime: 1 });
    const html = fields.bodyHtml;
    expect(html).toContain('<figure class="width-wide">');
    expect(html).toContain(`srcset="/media/${LEAD}.webp?w=520 520w`);
    expect(html).toMatch(/alt="A musher"[^>]* width="520" height="390"/);
    expect(html).toContain(`srcset="/media/${PHOTO}.avif?w=400 400w`);
    expect(html).toMatch(/alt="Coronavirus"[^>]* width="400" height="300"/);
    expect(html).toContain('<span class="figure-credit">© CDC</span>');
    expect(html).toMatch(new RegExp(`<img src="${IMG}/missing.webp" alt="Not in the library" loading="lazy"`));
    expect(fields.bodyMeta.toc).toEqual([{ depth: 2, id: "first-section", text: "First section" }]);
    // An episode's cover art is its largest picture, above the body: no body image is eager or high.
    const episode = (await postBodyFields(e, BODY, true)).bodyHtml;
    expect(episode).not.toContain("fetchpriority");
    expect(episode).not.toContain('loading="eager"');
  });

  it("refuses a figure without alt text, with Prelum's reason", async () => {
    await expect(postBodyFields(e, `:::figure{src="${IMG}/${PHOTO}"}\nx\n:::`, false)).rejects.toThrow("requires an alt attribute");
  });
});

describe("a read", () => {
  const row = { bodyHtml: "<p>stored</p>", bodyMeta: { toc: [], faq: [] } };

  it("serves the stored HTML while its version is Prelum's, and renders a stale one in memory", async () => {
    expect((await storedBody(e, { ...row, body: "fresh", renderVersion: RENDER_VERSION })).html).toBe(`<div data-render-version="${RENDER_VERSION}"><p>stored</p></div>`);
    expect((await storedBody(e, { ...row, body: "fresh", renderVersion: "0" })).html).toBe(`<div data-render-version="${RENDER_VERSION}"><p>fresh</p></div>`);
  });

  it("serves a row not converted yet as the HTML it still holds", async () => {
    expect((await storedBody(e, { body: "<p>old <em>html</em></p>", bodyHtml: null, renderVersion: null })).html).toBe("<p>old <em>html</em></p>");
  });
});

describe("the nightly re-render", () => {
  it("renders a stale row again and leaves an unconverted one alone", async () => {
    await e.DB.exec(`
      INSERT INTO posts (kind, title, slug, body, body_html, render_version, status) VALUES ('article', 'S', 'stale', 'New *words*', '<p>old</p>', '0', 'published');
      INSERT INTO posts (kind, title, slug, body, status) VALUES ('article', 'L', 'legacy', '<p>html</p>', 'published');
    `);
    expect(await rerenderStale(e)).toMatchObject({ posts: 1, failed: 0 });
    const read = (slug: string) => e.DB.prepare("SELECT body, body_html, render_version FROM posts WHERE slug = ?").bind(slug).first();
    expect(await read("stale")).toEqual({ body: "New *words*", body_html: "<p>New <em>words</em></p>", render_version: RENDER_VERSION });
    expect(await read("legacy")).toEqual({ body: "<p>html</p>", body_html: null, render_version: null });
  });
});

describe("demoteHeadings", () => {
  it("moves every heading down one level, keeping Prelum's ids, so the page keeps its own h1 and h2s", () => {
    expect(demoteHeadings('<h2 id="a">A<a class="heading-anchor" href="#a">#</a></h2>')).toBe('<h3 id="a">A<a class="heading-anchor" href="#a">#</a></h3>');
    expect(demoteHeadings("<h1>a</h1><h5>b</h5><h6>c</h6><p>d</p>")).toBe("<h2>a</h2><h6>b</h6><h6>c</h6><p>d</p>");
  });
});
