import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "@dustinedwards/devkit/d1";
import { applyMigrations } from "./helpers/d1";
import { routeContext } from "./helpers/harness";

// The feeds and llms-full.txt print each post's body (and, for episodes, point at the transcript),
// so they must read full rows, not the listing cards that leave body and transcript out.
const e = env as unknown as Env;
const ORIGIN = "https://germomics.com";

async function load(
  route: Promise<{ loader: (args: never) => unknown }>,
  path: string,
  params: Record<string, string> = {},
): Promise<Response> {
  const { loader } = await route;
  const context = routeContext(e);
  return (await loader({
    request: new Request(`${ORIGIN}${path}`),
    context,
    params,
  } as never)) as Response;
}

beforeAll(() => applyMigrations(e.DB), 60_000);
beforeEach(async () => {
  await resetDb(e.DB);
  await e.DB.prepare(
    "INSERT INTO posts (kind, slug, title, status, published_at, guid, audio_url, body, transcript) VALUES ('episode', 'ep-1', 'Episode one', 'published', '2024-01-01T00:00:00.000Z', 'urn:germomics:ep-1', 'https://media.germomics.com/ep1.mp3', '<p>Episode show notes</p>', 'WEBVTT')",
  ).run();
  await e.DB.prepare(
    "INSERT INTO posts (kind, slug, title, status, published_at, body) VALUES ('article', 'essay', 'An essay', 'published', '2024-02-01T00:00:00.000Z', '<p>Essay body text</p>')",
  ).run();
  await e.DB.prepare(
    "INSERT INTO posts (kind, slug, title, status, body, transcript, audio_url, guid) VALUES ('episode', 'draft-ep', 'Draft', 'draft', '<p>Secret notes</p>', 'WEBVTT', 'https://media.germomics.com/d.mp3', 'urn:germomics:d')",
  ).run();
});

describe("the podcast feed", () => {
  it("carries each episode's show notes and transcript link, and no drafts", async () => {
    const res = await load(import("~/routes/feed.podcast"), "/feed/podcast/");
    expect(res.headers.get("Content-Type")).toBe("application/rss+xml; charset=utf-8");
    const xml = await res.text();
    expect(xml).toContain('<guid isPermaLink="false">urn:germomics:ep-1</guid>');
    expect(xml).toContain(
      "<content:encoded><![CDATA[<p>Episode show notes</p>]]></content:encoded>",
    );
    expect(xml).toContain(
      `<podcast:transcript url="${ORIGIN}/ep-1/transcript.vtt" type="text/vtt"/>`,
    );
    expect(xml).not.toContain("Secret notes");
    expect(xml).not.toContain("urn:germomics:d");
  }, 60_000);

  it("escapes the enclosure type, so one odd value cannot break the one feed URL", async () => {
    await e.DB.prepare("UPDATE posts SET audio_mime_type = ? WHERE slug = 'ep-1'")
      .bind('audio/mpeg"&<x')
      .run();
    const xml = await (await load(import("~/routes/feed.podcast"), "/feed/podcast/")).text();
    expect(xml).toContain('type="audio/mpeg&quot;&amp;&lt;x"');
  }, 60_000);
});

describe("an address with nothing behind it", () => {
  it("answers 404 for a tag and a guest no post names, so no page carries the made-up text", async () => {
    const tag = await import("~/routes/tag.$tag");
    const guest = await import("~/routes/guests.$guest");
    const thrown = async (run: Promise<unknown>) =>
      ((await run.catch((r: Response) => r)) as Response).status;
    expect(await thrown(load(Promise.resolve(tag), "/tag/spam", { tag: "spam" }) as never)).toBe(
      404,
    );
    expect(
      await thrown(load(Promise.resolve(guest), "/guests/spam", { guest: "spam" }) as never),
    ).toBe(404);
  }, 60_000);
});

describe("the writing feed", () => {
  it("carries each article's body", async () => {
    const xml = await (await load(import("~/routes/feed.site"), "/feed/site.xml")).text();
    expect(xml).toContain("<content:encoded><![CDATA[<p>Essay body text</p>]]></content:encoded>");
    expect(xml).not.toContain("Episode show notes");
  }, 60_000);
});

describe("llms-full.txt", () => {
  it("prints the body of every episode and article", async () => {
    const txt = await (await load(import("~/routes/llms-full"), "/llms-full.txt")).text();
    expect(txt).toContain("Episode show notes");
    expect(txt).toContain("Essay body text");
    expect(txt).not.toContain("Secret notes");
  }, 60_000);
});
