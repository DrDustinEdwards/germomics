// Worker abuse limits, server-only (never import into client code): per-IP rate limits on /admin/*,
// /admin/ai and the signup POST (site-runtime's limiter), and a per-day cap on the AI endpoint so
// spend can't run away. Cloudflare's WAF managed ruleset and bot rules are the primary perimeter
// defense; this is the in-Worker layer. Security headers are security-headers.ts.

import { ipKey, limit, limitedResponse, matchRule, mustStop } from "@dustinedwards/site-runtime/rate-limit";
import { loadSettings, settingNum } from "~/lib/content.server";

// Per-IP fixed 60-second windows, counted exactly by the RATE_LIMITER Durable Object (the WAF
// rate-limit ruleset stays the hard control). Admin page navigation is generous; AI is tight.
// Per-minute limits are tunable live via the settings table (ratelimit.*), falling back to these
// defaults. A counter that is down lets the request through (logged by site-runtime): /admin sits
// behind Access, the AI endpoint has its own daily cap, and a signup is one row.
const RULES: Array<{ path: string; prefix?: boolean; methods?: string[]; bucket: string; settingKey: string; def: number; json: boolean }> = [
  { path: "/admin/ai", prefix: true, bucket: "ai", settingKey: "ratelimit.ai", def: 15, json: true },
  // The drafting routine's job URL: a key per job guards it, this keeps guessing slow.
  { path: "/api/ai-drafts/", prefix: true, bucket: "ai-drafts", settingKey: "ratelimit.ai", def: 15, json: true },
  { path: "/admin", prefix: true, bucket: "admin", settingKey: "ratelimit.admin", def: 150, json: false },
  // A signup stores an address, so a script could fill the list (Grok audit 2026-10-21, GE-6).
  // Only the POST is metered; reading the page is not. /subscribe.data is the same action.
  ...["/subscribe", "/subscribe.data"].map((path) => ({ path, methods: ["POST"], bucket: "subscribe", settingKey: "ratelimit.subscribe", def: 5, json: false })),
];

/** Returns a 429 Response if this request is rate-limited, otherwise null. */
export async function enforceRateLimit(env: Env, request: Request): Promise<Response | null> {
  const match = matchRule(request, RULES);
  if (!match) return null;
  const max = settingNum(await loadSettings(env), match.settingKey, match.def);
  const verdict = await limit(env.RATE_LIMITER, ipKey(match.bucket, request).key, [{ limit: max, windowSeconds: 60 }], { onUnavailable: "allow" });
  if (!mustStop(verdict, "allow")) return null;
  if (!match.json) return limitedResponse(verdict);
  return new Response(JSON.stringify({ ok: false, error: "Too many requests. Slow down and try again shortly." }), {
    status: 429,
    headers: { "Content-Type": "application/json; charset=utf-8", "Retry-After": String(verdict.retryAfterSeconds), "Cache-Control": "no-store" },
  });
}

// ── AI per-day cost cap ──────────────────────────────────────────────────────

// Max drafting sessions started per day across the single admin, so the subscription cannot be
// drained by a stuck button. Tunable live via the ai.daily_cap setting.
const AI_DAILY_CAP_DEFAULT = 100;

async function aiCap(env: Env): Promise<number> {
  return settingNum(await loadSettings(env), "ai.daily_cap", AI_DAILY_CAP_DEFAULT);
}

function capKey(): string {
  return `ai:cap:${new Date().toISOString().slice(0, 10)}`; // per UTC day
}

/** True if today's AI generations are at/over the cap (check before generating). */
export async function aiCostCapExceeded(env: Env): Promise<boolean> {
  return (Number(await env.APP_KV.get(capKey())) || 0) >= (await aiCap(env));
}

/** Record one successful AI generation against today's cap. */
export async function recordAiUse(env: Env): Promise<void> {
  const key = capKey();
  const used = Number(await env.APP_KV.get(key)) || 0;
  await env.APP_KV.put(key, String(used + 1), { expirationTtl: 60 * 60 * 36 }); // ~1.5 days
}
