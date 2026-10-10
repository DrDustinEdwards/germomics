import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RouterContextProvider } from "react-router";
import { cloudflareContext } from "~/lib/context.server";
import { applyMigrations } from "./helpers/d1";

// The feeds and llms-full.txt print each post's body (and, for episodes, point at the transcript),
// so they must read full rows, not the listing cards that leave body and transcript out.
const e = env as unknown as Env;
const ORIGIN = "https://germomics.com";

async function load(route: Promise<{ loader: (args: never) => unknown }>, path: string): Promise<Response> {
  const { loader } = await route;
  const context = new RouterContextProvider();
  context.set(cloudflareContext, { env: e, ctx: {} as ExecutionContext });
  return (await loader({ request: new Request(`${ORIGIN}${path}`), context, params: {} } as never)) as Response;
}

beforeAll(() => applyMigrations(e.DB), 60_000);
beforeEach(async () => {
  for (const t of ["episode_people", "soundbites", "post_versions", "posts"]) await e.DB.exec(`DELETE FROM ${t}`);
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
    expect(xml).toContain("<content:encoded><![CDATA[<p>Episode show notes</p>]]></content:encoded>");
    expect(xml).toContain(`<podcast:transcript url="${ORIGIN}/ep-1/transcript.vtt" type="text/vtt"/>`);
    expect(xml).not.toContain("Secret notes");
    expect(xml).not.toContain("urn:germomics:d");
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
