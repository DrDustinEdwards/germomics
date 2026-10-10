import { env } from "cloudflare:test";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { RouterContextProvider } from "react-router";
import { cloudflareContext } from "~/lib/context.server";
import { STYLE_RULE } from "~/lib/ai.server";
import { SETTING_DEFAULTS } from "~/lib/content-defaults";
import { applyMigrations } from "./helpers/d1";

// The admin AI endpoint (app/routes/admin.ai.ts) and the generators behind it (app/lib/ai.server.ts),
// with the Messages API replaced by a stub: the key is required, the daily cap is enforced and
// counted only on success, each kind's answer is parsed, every prompt carries the style rule
// (CLAUDE.md hard rule 5), and API failures become readable errors.
const e = env as unknown as Env;
const KEY = "test-not-a-real-key";
let action: typeof import("~/routes/admin.ai").action;
let sent: { headers: Headers; body: any }[] = [];
let reply: () => Response;

const call = (fields: Record<string, string>, over: Record<string, unknown> = { ANTHROPIC_API_KEY: KEY }) => {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  const context = new RouterContextProvider();
  context.set(cloudflareContext, { env: { ...e, ...over } as Env, ctx: {} as ExecutionContext });
  return action({ request: new Request("https://germomics.com/admin/ai", { method: "POST", body }), context, params: {} } as never) as Promise<Response>;
};
const text = (t: string) => () => Response.json({ content: [{ type: "text", text: t }] });
const capUsed = async () => Number(await e.APP_KV.get(`ai:cap:${new Date().toISOString().slice(0, 10)}`)) || 0;
const TRANSCRIPT = "WEBVTT\n\n00:00.000 --> 00:05.000\nCholera in London.";

beforeAll(async () => {
  await applyMigrations(e.DB);
  await e.DB.exec("DELETE FROM content_blocks");
  ({ action } = await import("~/routes/admin.ai"));
}, 120_000);

beforeEach(async () => {
  const { keys } = await e.APP_KV.list();
  await Promise.all(keys.map((k) => e.APP_KV.delete(k.name)));
  await e.APP_KV.put("cache:content:settings", JSON.stringify({ "ai.daily_cap": "2" }));
  sent = [];
  reply = text("<p>Notes</p>");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    if (url !== "https://api.anthropic.com/v1/messages") return new Response("unexpected", { status: 599 });
    sent.push({ headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    return reply();
  });
});
afterEach(() => vi.restoreAllMocks());

describe("the admin AI endpoint", () => {
  it("answers 503 and calls nothing when no key is configured", async () => {
    const res = await call({ kind: "shownotes", transcript: TRANSCRIPT }, {});
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, error: "AI is not configured. Set the ANTHROPIC_API_KEY worker secret." });
    expect(sent).toHaveLength(0);
  });

  it("drafts show notes with the key, the model and a prompt that carries the style rule, and counts the use", async () => {
    const res = await call({ kind: "shownotes", transcript: TRANSCRIPT });
    expect(await res.json()).toEqual({ ok: true, kind: "shownotes", draft: "<p>Notes</p>" });
    expect(sent[0].headers.get("x-api-key")).toBe(KEY);
    expect(sent[0].headers.get("anthropic-version")).toBe("2023-06-01");
    expect(sent[0].body).toMatchObject({ model: "claude-sonnet-4-6", max_tokens: 1800 });
    expect(sent[0].body.system).toContain(STYLE_RULE);
    expect(sent[0].body.messages[0].content).toContain("Cholera in London.");
    expect(await capUsed()).toBe(1);
  });

  it("keeps the stored style rule in step with STYLE_RULE, so a prompt edited in settings still starts from it", () => {
    expect(SETTING_DEFAULTS["ai.prompt.style"]).toBe(STYLE_RULE);
  });

  it("joins only the text blocks of a reply, trimmed", async () => {
    reply = () => Response.json({ content: [{ type: "text", text: "  <p>A" }, { type: "tool_use", id: "x" }, { type: "text", text: "B</p>  " }, { type: "text" }] });
    expect(await (await call({ kind: "shownotes", transcript: TRANSCRIPT })).json()).toEqual({ ok: true, kind: "shownotes", draft: "<p>AB</p>" });
    reply = () => Response.json({});
    expect(await (await call({ kind: "shownotes", transcript: TRANSCRIPT })).json()).toEqual({ ok: true, kind: "shownotes", draft: "" });
  });

  it("uses a model and prompt changed in settings", async () => {
    await e.APP_KV.put("cache:content:settings", JSON.stringify({ "ai.model": "test-model", "ai.prompt.shownotes": "CUSTOM PROMPT" }));
    await call({ kind: "shownotes", transcript: TRANSCRIPT });
    expect(sent[0].body.model).toBe("test-model");
    expect(sent[0].body.messages[0].content.startsWith("CUSTOM PROMPT")).toBe(true);
  });

  it("refuses once the daily cap is reached, without calling the API", async () => {
    await call({ kind: "shownotes", transcript: TRANSCRIPT });
    await call({ kind: "shownotes", transcript: TRANSCRIPT });
    const res = await call({ kind: "shownotes", transcript: TRANSCRIPT });
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ ok: false, error: "Daily AI limit reached. Try again tomorrow." });
    expect(sent).toHaveLength(2);
  });

  it("parses chapters, in order, from a fenced reply, and drops unusable ones", async () => {
    reply = text('Here:\n```json\n[{"startTime": 90.6, "title": " Later "}, {"start": 0, "title": "Intro"}, {"startTime": "x", "title": "Bad"}, {"startTime": 5, "title": ""}]\n```');
    const res = await call({ kind: "chapters", transcript: TRANSCRIPT });
    expect(await res.json()).toEqual({ ok: true, kind: "chapters", draft: [{ start: 0, title: "Intro" }, { start: 90, title: "Later" }] });
    expect(sent[0].body.max_tokens).toBe(1200);
  });

  it("refuses chapters it cannot use", async () => {
    reply = text('{"not": "a list"}');
    expect(await (await call({ kind: "chapters", transcript: TRANSCRIPT })).json()).toEqual({ ok: false, error: "The AI returned an unexpected chapters format." });
    reply = text("[]");
    const res = await call({ kind: "chapters", transcript: TRANSCRIPT });
    expect(res.status).toBe(502);
    expect(((await res.json()) as { error: string }).error).toBe("The AI didn’t return any usable chapters.");
    expect(await capUsed()).toBe(0);
  });

  it("drafts SEO fields from JSON, capped in length, with the title in the prompt", async () => {
    reply = text(JSON.stringify({ seoTitle: "T".repeat(200), seoDescription: " D ", socialBlurb: "S" }));
    const res = await call({ kind: "seo", transcript: TRANSCRIPT, title: "Broad Street" });
    const body = (await res.json()) as { draft: Record<string, string> };
    expect(body.draft).toEqual({ seoTitle: "T".repeat(120), seoDescription: "D", socialBlurb: "S" });
    expect(sent[0].body.messages[0].content).toContain('Episode working title: "Broad Street"');
  });

  it("reads SEO JSON out of a fenced reply with prose around it, and names a missing title", async () => {
    reply = text('```json\nSure! {"seoTitle": " Pump ", "seoDescription": "Desc", "socialBlurb": " Blurb "} Hope that helps.\n```');
    const res = await call({ kind: "seo", transcript: TRANSCRIPT });
    expect(((await res.json()) as { draft: unknown }).draft).toEqual({ seoTitle: "Pump", seoDescription: "Desc", socialBlurb: "Blurb" });
    expect(sent[0].body.messages[0].content).toContain('Episode working title: "(untitled)"');
    expect(sent[0].body.max_tokens).toBe(600);
    reply = text('{"seoTitle": "Only"}');
    const partial = await call({ kind: "seo", transcript: TRANSCRIPT });
    expect(((await partial.json()) as { draft: unknown }).draft).toEqual({ seoTitle: "Only", seoDescription: "", socialBlurb: "" });
  });

  it("finds a chapters list even when an object appears after it, and an object before a list is refused", async () => {
    reply = text('[{"start": 3, "title": "A"}] and {"note": 1}');
    expect(((await (await call({ kind: "chapters", transcript: TRANSCRIPT })).json()) as { ok: boolean }).ok).toBe(false);
    reply = text('[{"start": 3, "title": "A"}]');
    expect(((await (await call({ kind: "chapters", transcript: TRANSCRIPT })).json()) as { draft: unknown }).draft).toEqual([{ start: 3, title: "A" }]);
    reply = text('{"chapters": 1} then [{"start": 3, "title": "A"}]');
    expect(((await (await call({ kind: "chapters", transcript: TRANSCRIPT })).json()) as { ok: boolean }).ok).toBe(false);
  });

  it("refuses an empty transcript and an unknown kind without calling the API", async () => {
    const empty = await call({ kind: "seo", transcript: "   " });
    expect(empty.status).toBe(502);
    expect(await empty.json()).toEqual({ ok: false, error: "This episode has no transcript yet. Add one first." });
    const unknown = await call({ kind: "poem", transcript: TRANSCRIPT });
    expect(unknown.status).toBe(400);
    expect(sent).toHaveLength(0);
    expect(await capUsed()).toBe(0);
  });

  it("turns API failures into readable errors and does not count them", async () => {
    const cases: [number, string][] = [
      [401, "ANTHROPIC_API_KEY is invalid or revoked."],
      [429, "AI rate limit hit. Wait a moment and try again."],
      [529, "AI service is overloaded. Try again shortly."],
      [500, "AI request failed (500): boom."],
    ];
    for (const [status, error] of cases) {
      reply = () => Response.json({ error: { message: "boom" } }, { status });
      const res = await call({ kind: "shownotes", transcript: TRANSCRIPT });
      expect(res.status).toBe(502);
      expect(await res.json()).toEqual({ ok: false, error });
    }
    reply = () => new Response("not json", { status: 500 });
    expect(await (await call({ kind: "shownotes", transcript: TRANSCRIPT })).json()).toEqual({ ok: false, error: "AI request failed (500)." });
    expect(await capUsed()).toBe(0);
  });

  it("says when the AI service cannot be reached", async () => {
    reply = () => {
      throw new TypeError("network down");
    };
    expect(await (await call({ kind: "shownotes", transcript: TRANSCRIPT })).json()).toEqual({
      ok: false,
      error: "Could not reach the AI service. Check your connection and try again.",
    });
  });
});
