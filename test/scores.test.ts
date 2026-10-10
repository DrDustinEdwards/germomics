import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getLeaderboard, sanitizeName, submitScore } from "~/lib/scores.server";
import { applyMigrations } from "./helpers/d1";

// The leaderboard is the one public write to D1: anyone can post a score. The guard must refuse an
// unknown game and a bad number, clamp a huge one, clean the name, and cap submissions per address.
const e = env as unknown as Env;
const GAME = "phage-defense";
const submit = (over: Partial<{ gameSlug: string; name: unknown; score: unknown; ip: string }> = {}) =>
  submitScore(e, { gameSlug: GAME, name: "Ada", score: 120, ip: "203.0.113.1", ...over });
const stored = async () => (await e.DB.prepare("SELECT game_slug, name, score FROM scores ORDER BY id").all()).results;

beforeAll(() => applyMigrations(e.DB));
beforeEach(async () => {
  await e.DB.exec("DELETE FROM scores");
  const { keys } = await e.APP_KV.list();
  await Promise.all(keys.map((k) => e.APP_KV.delete(k.name)));
});

describe("submitScore", () => {
  it("stores a valid score, rounded down", async () => {
    expect(await submit({ score: "120.9" })).toEqual({ ok: true, score: 120 });
    expect(await stored()).toEqual([{ game_slug: GAME, name: "Ada", score: 120 }]);
  });

  it("refuses an unknown game, a negative score and one that is not a number, storing nothing", async () => {
    expect(await submit({ gameSlug: "not-a-game" })).toEqual({ ok: false, error: "Unknown game." });
    expect(await submit({ score: -1 })).toEqual({ ok: false, error: "Invalid score." });
    expect(await submit({ score: "lots" })).toEqual({ ok: false, error: "Invalid score." });
    expect(await submit({ score: Infinity })).toEqual({ ok: false, error: "Invalid score." });
    expect(await stored()).toEqual([]);
    expect((await e.APP_KV.list()).keys).toHaveLength(0);
  });

  it("accepts zero and clamps anything over a million", async () => {
    expect(await submit({ score: 0 })).toEqual({ ok: true, score: 0 });
    expect(await submit({ score: 5_000_000 })).toEqual({ ok: true, score: 1_000_000 });
    expect(await submit({ score: 1_000_000 })).toEqual({ ok: true, score: 1_000_000 });
  });

  it("allows five submissions a minute per address and game, then refuses", async () => {
    for (let i = 0; i < 5; i++) expect((await submit()).ok).toBe(true);
    expect(await submit()).toEqual({ ok: false, error: "Too many submissions, try again in a minute." });
    expect(await stored()).toHaveLength(5);
    expect((await submit({ ip: "203.0.113.2" })).ok).toBe(true);
    const { keys } = await e.APP_KV.list({ prefix: "score-rl:" });
    const mine = keys.find((k) => k.name === `score-rl:${GAME}:203.0.113.1`)!;
    expect(mine.expiration! - Date.now() / 1000).toBeLessThanOrEqual(60);
    expect(mine.expiration! - Date.now() / 1000).toBeGreaterThan(55);
  });
});

describe("sanitizeName", () => {
  it("keeps letters, digits, spaces, underscores and hyphens, trims, then caps at 20", () => {
    expect(sanitizeName("  Zoë_99 -x<script>  ")).toBe("Zoë_99 -xscript");
    expect(sanitizeName("a".repeat(30))).toBe("a".repeat(20));
    expect(sanitizeName(" ".repeat(25) + "b")).toBe("b");
  });

  it("falls back to anon for nothing usable", () => {
    expect(sanitizeName("<<>>")).toBe("anon");
    expect(sanitizeName(undefined)).toBe("anon");
    expect(sanitizeName(null)).toBe("anon");
  });
});

describe("getLeaderboard", () => {
  it("returns one game's scores, highest first, up to the limit", async () => {
    for (const [slug, name, score] of [[GAME, "a", 5], [GAME, "b", 50], [GAME, "c", 20], ["other", "d", 999]] as const) {
      await e.DB.prepare("INSERT INTO scores (game_slug, name, score) VALUES (?, ?, ?)").bind(slug, name, score).run();
    }
    expect((await getLeaderboard(e, GAME)).map((s) => s.name)).toEqual(["b", "c", "a"]);
    expect((await getLeaderboard(e, GAME, 2)).map((s) => s.score)).toEqual([50, 20]);
  });
});
