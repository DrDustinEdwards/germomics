// Leaderboard reads + the GUARDED public write. scores is a public write endpoint, so the
// submit path validates and clamps the score, sanitizes + caps the name, and rate-limits per
// IP (site-runtime's RateLimiter Durable Object) before touching D1. Built in now, not later (per
// the leaderboard guard ask).
import { limit as rateLimit, mustStop } from "@dustinedwards/site-runtime/rate-limit";
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

  // Rate-limit by IP (fixed window). A counter that is down lets the score through (logged): the
  // name and score are already clamped, so the worst case is a few extra leaderboard rows.
  const rule = { limit: RL_MAX_PER_WINDOW, windowSeconds: RL_WINDOW_SECONDS };
  const verdict = await rateLimit(env.RATE_LIMITER, `score:${input.gameSlug}:${input.ip}`, [rule], { onUnavailable: "allow" });
  if (mustStop(verdict, "allow")) return { ok: false, error: "Too many submissions, try again in a minute." };

  await getDb(env).insert(scores).values({
    gameSlug: input.gameSlug,
    name: sanitizeName(input.name),
    score,
  });
  return { ok: true, score };
}
