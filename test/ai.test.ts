import { env } from "cloudflare:test";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { RouterContextProvider } from "react-router";
import { cloudflareContext } from "~/lib/context.server";
import { STYLE_RULE } from "~/lib/ai.server";
import { SETTING_DEFAULTS } from "~/lib/content-defaults";
import { applyMigrations, setSettings } from "./helpers/d1";

// AI drafts on the subscription (app/lib/ai.server.ts): the editor's button fires the drafting
// routine with only a job URL and key, the routine GETs the job and POSTs the draft back, and the
// editor polls until it is ready. The routine's fire endpoint is stubbed; the site calls no model.
const e = env as unknown as Env;
const FIRE = "https://api.anthropic.com/v1/claude_code/routines/trig_01TestTest/fire";
const CONFIG = { AI_ROUTINE_URL: FIRE, AI_ROUTINE_TOKEN: "test-not-a-real-token" };
const TRANSCRIPT = "WEBVTT\n\n00:00.000 --> 00:05.000\nCholera in London.";
type Mod = { loader: (a: never) => Promise<Response>; action: (a: never) => Promise<Response> };
let admin: Mod;
let api: Mod;
let fired: string[] = [];
let fireReply: () => Response;

const ctx = (over: Record<string, unknown>) => {
  const context = new RouterContextProvider();
  context.set(cloudflareContext, { env: { ...e, ...over } as Env, ctx: {} as ExecutionContext });
  return context;
};
const start = async (fields: Record<string, string>, over: Record<string, unknown> = CONFIG) => {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.set(k, v);
  return admin.action({ request: new Request("https://germomics.com/admin/ai", { method: "POST", body }), context: ctx(over), params: {} } as never);
};
const poll = async (job: string) => (await admin.loader({ request: new Request(`https://germomics.com/admin/ai?job=${job}`), context: ctx(CONFIG), params: {} } as never)).json() as Promise<Record<string, unknown>>;
// What the routine reads out of its fire text, and its two calls back.
const handoff = () => {
  const text = fired.at(-1) ?? "";
  return { id: /\/api\/ai-drafts\/([0-9a-f]+)/.exec(text)![1], key: /job_key: (\S+)/.exec(text)![1] };
};
const routineGet = (id: string, key: string) =>
  api.loader({ request: new Request(`https://germomics.com/api/ai-drafts/${id}`, { headers: { Authorization: `Bearer ${key}` } }), context: ctx(CONFIG), params: { id } } as never);
const routinePost = (id: string, key: string, body: unknown) =>
  api.action({
    request: new Request(`https://germomics.com/api/ai-drafts/${id}`, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: JSON.stringify(body) }),
    context: ctx(CONFIG),
    params: { id },
  } as never);
const capUsed = async () => Number(await e.APP_KV.get(`ai:cap:${new Date().toISOString().slice(0, 10)}`)) || 0;
/** Start a job of `kind`, have the routine answer `draft`, and return what the editor's poll then sees. */
const roundTrip = async (kind: string, draft: string) => {
  const { job } = (await (await start({ kind, transcript: TRANSCRIPT, title: "Broad Street" })).json()) as { job: string };
  const { id, key } = handoff();
  expect(id).toBe(job);
  expect((await routinePost(id, key, { draft })).status).toBe(200);
  return poll(job);
};

beforeAll(async () => {
  await applyMigrations(e.DB);
  await e.DB.exec("DELETE FROM content_blocks");
  admin = (await import("~/routes/admin.ai")) as unknown as Mod;
  api = (await import("~/routes/api.ai-drafts.$id")) as unknown as Mod;
}, 120_000);

beforeEach(async () => {
  const { keys } = await e.APP_KV.list();
  await Promise.all(keys.map((k) => e.APP_KV.delete(k.name)));
  await setSettings(e.DB, { "ai.daily_cap": "5" });
  fired = [];
  fireReply = () => Response.json({ type: "routine_fire", claude_code_session_url: "https://claude.ai/code/session_01TestSession" });
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    if (url !== FIRE) return new Response("unexpected", { status: 599 });
    fired.push(JSON.parse(String(init?.body)).text);
    return fireReply();
  });
});
afterEach(() => vi.restoreAllMocks());

describe("AI drafts on the drafting routine", () => {
  it("fires the routine with only a job URL and key, hands the routine the live prompt and transcript, and gives the editor the draft", async () => {
    await setSettings(e.DB, { "ai.daily_cap": "5", "ai.prompt.shownotes": "CUSTOM PROMPT" });
    const res = await start({ kind: "shownotes", transcript: TRANSCRIPT });
    const { job } = (await res.json()) as { job: string };
    expect(fired[0]).not.toContain("Cholera");
    expect(await poll(job)).toMatchObject({ status: "waiting" });

    const { id, key } = handoff();
    const given = (await (await routineGet(id, key)).json()) as { kind: string; system: string; prompt: string };
    expect(given.kind).toBe("shownotes");
    expect(given.system).toContain(STYLE_RULE);
    expect(given.prompt.startsWith("CUSTOM PROMPT")).toBe(true);
    expect(given.prompt).toContain("Cholera in London.");

    expect((await routinePost(id, key, { draft: "  <p>Notes</p> " })).status).toBe(200);
    expect(await poll(job)).toMatchObject({ status: "ready", draft: "<p>Notes</p>" });
    expect((await routinePost(id, key, { draft: "<p>Again</p>" })).status).toBe(409);
    expect(await capUsed()).toBe(1);
  });

  it("PLANT: a job opens only with its own key", async () => {
    await start({ kind: "shownotes", transcript: TRANSCRIPT });
    const { id, key } = handoff();
    await start({ kind: "seo", transcript: TRANSCRIPT });
    const other = handoff();
    for (const res of [await routineGet(id, ""), await routineGet(id, other.key), await routinePost(id, other.key, { draft: "x" }), await routineGet("0".repeat(32), key)]) {
      expect(res.status).toBe(404);
    }
    expect((await routineGet(id, key)).status).toBe(200);
  });

  it("keeps the stored style rule in step with STYLE_RULE, so a prompt edited in settings still starts from it", () => {
    expect(SETTING_DEFAULTS["ai.prompt.style"]).toBe(STYLE_RULE);
  });

  it("parses chapters and SEO answers into the editor's shapes, and fails a job whose answer it cannot use", async () => {
    expect(await roundTrip("chapters", 'Here:\n```json\n[{"startTime": 90.6, "title": " Later "}, {"start": 0, "title": "Intro"}, {"startTime": "x", "title": "Bad"}]\n```')).toMatchObject({
      status: "ready",
      draft: [{ start: 0, title: "Intro" }, { start: 90, title: "Later" }],
    });
    expect(await roundTrip("seo", `Sure! {"seoTitle": "${"T".repeat(200)}", "seoDescription": " D "} Hope that helps.`)).toMatchObject({
      status: "ready",
      draft: { seoTitle: "T".repeat(120), seoDescription: "D", socialBlurb: "" },
    });
    expect(await roundTrip("chapters", '{"not": "a list"}')).toMatchObject({ status: "failed", error: "The AI returned an unexpected chapters format." });
    expect(await roundTrip("seo", "not json at all")).toMatchObject({ status: "failed", error: "The AI returned an answer that is not valid JSON." });
  });

  it("refuses to start without the routine, a transcript or a known kind, and past the daily cap", async () => {
    const off = await start({ kind: "shownotes", transcript: TRANSCRIPT }, {});
    expect(off.status).toBe(503);
    expect(await off.json()).toEqual({ ok: false, error: "AI drafting is not set up. Set the AI_ROUTINE_URL and AI_ROUTINE_TOKEN worker secrets." });
    expect(await (await start({ kind: "seo", transcript: "   " })).json()).toEqual({ ok: false, error: "This episode has no transcript yet. Add one first." });
    expect((await start({ kind: "poem", transcript: TRANSCRIPT })).status).toBe(400);
    expect(fired).toHaveLength(0);
    for (let i = 0; i < 5; i++) await start({ kind: "shownotes", transcript: TRANSCRIPT });
    expect(await (await start({ kind: "shownotes", transcript: TRANSCRIPT })).json()).toEqual({ ok: false, error: "Daily AI limit reached. Try again tomorrow." });
    expect(fired).toHaveLength(5);
  });

  it("says when the routine will not start, keeps no job and does not count it", async () => {
    fireReply = () => Response.json({ error: { type: "rate_limit_error" } }, { status: 429 });
    expect(await (await start({ kind: "shownotes", transcript: TRANSCRIPT })).json()).toEqual({ ok: false, error: "Too many drafting sessions this hour. Try again later." });
    fireReply = () => Response.json({}, { status: 401 });
    expect(await (await start({ kind: "shownotes", transcript: TRANSCRIPT })).json()).toEqual({ ok: false, error: "The drafting routine did not start (401)." });
    expect((await e.APP_KV.list({ prefix: "ai:job:" })).keys).toHaveLength(0);
    expect(await capUsed()).toBe(0);
  });

  it("passes on a session's own refusal to the editor", async () => {
    const { job } = (await (await start({ kind: "shownotes", transcript: TRANSCRIPT })).json()) as { job: string };
    const { id, key } = handoff();
    expect((await routinePost(id, key, { draft: "" })).status).toBe(400);
    expect((await routinePost(id, key, { error: "The transcript is cut off." })).status).toBe(200);
    expect(await poll(job)).toMatchObject({ status: "failed", error: "The drafting session could not write it: The transcript is cut off." });
  });
});
