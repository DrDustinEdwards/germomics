// Leaderboard reads + the GUARDED public write. scores is a public write endpoint, so the
// submit path validates and clamps the score, sanitizes + caps the name, and rate-limits per
// IP via APP_KV before touching D1. Built in now, not later (per the leaderboard guard ask).
import { desc, eq } from "drizzle-orm";
import { getDb } from "~/db/index.server";
import { scores, type Score } from "~/db/schema";
import { getGame } from "~/lib/games.server";

const MAX_SCORE = 1_000_000;
const NAME_MAX = 20;
const RL_WINDOW_SECONDS = 60;
const RL_MAX_PER_WINDOW = 5;

export async function getLeaderboard(env: Env, gameSlug: string, limit = 10): Promise<Score[]> {
  const db = getDb(env);
  return db
    .select()
    .from(scores)
    .where(eq(scores.gameSlug, gameSlug))
    .orderBy(desc(scores.score))
    .limit(limit);
}

export function sanitizeName(raw: unknown): string {
  const cleaned = String(raw ?? "")
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .trim()
    .slice(0, NAME_MAX);
  return cleaned || "anon";
}

type SubmitResult = { ok: true; score: number } | { ok: false; error: string };

export async function submitScore(
  env: Env,
  input: { gameSlug: string; name: unknown; score: unknown; ip: string },
): Promise<SubmitResult> {
  if (!getGame(input.gameSlug)) return { ok: false, error: "Unknown game." };

  // Validate + clamp the score server-side — never trust the client number.
  const raw = Math.floor(Number(input.score));
  if (!Number.isFinite(raw) || raw < 0) return { ok: false, error: "Invalid score." };
  const score = Math.min(raw, MAX_SCORE);

  // Rate-limit by IP via KV (fixed window).
  const rlKey = `score-rl:${input.gameSlug}:${input.ip}`;
  const count = Number(await env.APP_KV.get(rlKey)) || 0;
  if (count >= RL_MAX_PER_WINDOW) {
    return { ok: false, error: "Too many submissions — try again in a minute." };
  }
  await env.APP_KV.put(rlKey, String(count + 1), { expirationTtl: RL_WINDOW_SECONDS });

  await getDb(env).insert(scores).values({
    gameSlug: input.gameSlug,
    name: sanitizeName(input.name),
    score,
  });
  return { ok: true, score };
}
