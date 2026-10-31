import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { RouterContextProvider } from "react-router";
import { cloudflareContext } from "~/lib/context.server";
import { applyMigrations } from "./helpers/d1";

// The three routes anyone on the internet can write through: the newsletter signup, the unsubscribe
// link, and a game's score submission. What they store, what they refuse, and (for unsubscribe)
// that merely opening the link changes nothing.
const e = env as unknown as Env;
type Args = { request: Request; params?: Record<string, string> };

function args({ request, params = {} }: Args) {
  const context = new RouterContextProvider();
  context.set(cloudflareContext, { env: e, ctx: {} as ExecutionContext });
  return { request, params, context } as never;
}
const post = (path: string, fields: Record<string, string>, headers: Record<string, string> = {}) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return new Request(`https://germomics.com${path}`, { method: "POST", body: form, headers });
};
const subscribers = async () =>
  (await e.DB.prepare("SELECT email, consented_at, unsubscribe_token, unsubscribed_at FROM subscribers ORDER BY id").all<Record<string, string | null>>()).results;

let subscribe: typeof import("~/routes/subscribe");
let unsubscribe: typeof import("~/routes/unsubscribe");
let game: typeof import("~/routes/games.$slug");

beforeAll(async () => {
  await applyMigrations(e.DB);
  [subscribe, unsubscribe, game] = await Promise.all([import("~/routes/subscribe"), import("~/routes/unsubscribe"), import("~/routes/games.$slug")]);
}, 120_000);

beforeEach(async () => {
  await e.DB.exec("DELETE FROM subscribers");
  await e.DB.exec("DELETE FROM scores");
  const { keys } = await e.APP_KV.list();
  await Promise.all(keys.map((k) => e.APP_KV.delete(k.name)));
});

describe("newsletter signup", () => {
  const signup = (fields: Record<string, string>) => subscribe.action(args({ request: post("/subscribe", fields) }));

  it("stores a trimmed, lowercased address with a consent time and an unsubscribe token", async () => {
    expect(await signup({ email: "  Ada@Example.COM ", consent: "on" })).toEqual({ ok: true });
    const [row] = await subscribers();
    expect(row.email).toBe("ada@example.com");
    expect(row.consented_at).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(row.unsubscribe_token).toMatch(/^[0-9a-f-]{36}$/);
    expect(row.unsubscribed_at).toBeNull();
  });

  it("refuses an address that is not one, or longer than 254 characters", async () => {
    for (const email of ["", "no-at-sign", "a@b", "a b@c.d", `${"a".repeat(250)}@b.co`]) {
      expect(await signup({ email, consent: "on" })).toEqual({ ok: false, error: "Please enter a valid email address." });
    }
    expect(await subscribers()).toEqual([]);
  });

  it("answers 413 to a body over the public ceiling without storing anything", async () => {
    const thrown = await signup({ email: "ada@example.com", consent: "on", pad: "x".repeat(20_000) }).catch((r: unknown) => r);
    expect((thrown as Response).status).toBe(413);
    expect(await subscribers()).toEqual([]);
  });

  it("refuses without the consent box ticked", async () => {
    for (const fields of [{ email: "ada@example.com" }, { email: "ada@example.com", consent: "true" }] as Record<string, string>[]) {
      expect(await signup(fields)).toEqual({ ok: false, error: "Please tick the consent box so we can email you." });
    }
    expect(await subscribers()).toEqual([]);
  });

  it("re-subscribing refreshes consent, clears an unsubscribe, and keeps the old token working", async () => {
    await signup({ email: "ada@example.com", consent: "on" });
    await e.DB.exec("UPDATE subscribers SET consented_at = '2000-01-01T00:00:00.000Z', unsubscribed_at = '2001-01-01T00:00:00.000Z'");
    const [before] = await subscribers();
    await signup({ email: "ADA@example.com", consent: "on" });
    const rows = await subscribers();
    expect(rows).toHaveLength(1);
    expect(rows[0].unsubscribed_at).toBeNull();
    expect(rows[0].consented_at! > "2000-01-01T00:00:00.000Z").toBe(true);
    expect(rows[0].unsubscribe_token).toBe(before.unsubscribe_token);
  });
});

describe("unsubscribe", () => {
  const TOKEN = "11111111-2222-3333-4444-555555555555";
  beforeEach(async () => {
    await e.DB.prepare("INSERT INTO subscribers (email, consented_at, unsubscribe_token) VALUES ('ada@example.com', '2026-01-01T00:00:00.000Z', ?)").bind(TOKEN).run();
    await e.DB.prepare("INSERT INTO subscribers (email, consented_at, unsubscribe_token) VALUES ('bystander@example.com', '2026-01-01T00:00:00.000Z', 'bystander-token')").run();
  });
  const open = (query: string) => unsubscribe.loader(args({ request: new Request(`https://germomics.com/unsubscribe${query}`) }));
  const unsubscribedAt = async () => (await subscribers())[0].unsubscribed_at;
  const bystanderUnsubscribedAt = async () => (await subscribers())[1].unsubscribed_at;

  it("opening the link only asks to confirm, so a mail scanner's visit changes nothing", async () => {
    expect(await open(`?token=${TOKEN}`)).toEqual({ status: "confirm", email: "ada@example.com", token: TOKEN });
    expect(await open(`?token=${TOKEN}`)).toEqual({ status: "confirm", email: "ada@example.com", token: TOKEN });
    expect(await unsubscribedAt()).toBeNull();
  });

  it("unsubscribes only that address on POST from the confirm button, then reports it as already done", async () => {
    expect(await unsubscribe.action(args({ request: post("/unsubscribe", { token: TOKEN }) }))).toEqual({ status: "done", email: "ada@example.com" });
    expect(await unsubscribedAt()).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(await bystanderUnsubscribedAt()).toBeNull();
    const first = await unsubscribedAt();
    expect(await unsubscribe.action(args({ request: post("/unsubscribe", { token: TOKEN }) }))).toEqual({ status: "already", email: "ada@example.com" });
    expect(await unsubscribedAt()).toBe(first);
    expect(await open(`?token=${TOKEN}`)).toEqual({ status: "already", email: "ada@example.com" });
  });

  it("accepts an RFC 8058 one-click POST with the token in the query string", async () => {
    const request = new Request(`https://germomics.com/unsubscribe?token=${TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
    });
    expect(await unsubscribe.action(args({ request }))).toEqual({ status: "done", email: "ada@example.com" });
  });

  it("refuses a missing or unknown token on both the visit and the POST, changing nothing", async () => {
    expect(await open("")).toEqual({ status: "invalid" });
    expect(await open("?token=not-a-real-token")).toEqual({ status: "invalid" });
    expect(await unsubscribe.action(args({ request: post("/unsubscribe", { token: "not-a-real-token" }) }))).toEqual({ status: "invalid" });
    expect(await unsubscribe.action(args({ request: post("/unsubscribe", {}) }))).toEqual({ status: "invalid" });
    expect(await unsubscribedAt()).toBeNull();
    expect(await bystanderUnsubscribedAt()).toBeNull();
  });
});

describe("game score submission", () => {
  const submit = (headers: Record<string, string>, slug = "phage-defense") =>
    game.action(args({ request: post(`/games/${slug}`, { name: "Ada", score: "10" }, headers), params: { slug } }));

  it("ignores a forwarded-for header a client could set, and puts requests with no address in one shared bucket", async () => {
    for (let i = 0; i < 5; i++) expect((await submit({ "X-Forwarded-For": `203.0.113.${i}` })).ok).toBe(true);
    expect((await submit({ "X-Forwarded-For": "203.0.113.99" })).ok).toBe(false);
  });

  it("stores the submitted score for the game in the URL, and refuses an unknown game", async () => {
    await submit({ "CF-Connecting-IP": "198.51.100.3" });
    expect((await e.DB.prepare("SELECT game_slug, name, score FROM scores").all()).results).toEqual([{ game_slug: "phage-defense", name: "Ada", score: 10 }]);
    expect(await submit({ "CF-Connecting-IP": "198.51.100.3" }, "no-such-game")).toEqual({ ok: false, error: "Unknown game.", input: true });
  });
});
