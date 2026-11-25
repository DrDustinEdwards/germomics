// In-Worker abuse limits, server-only: per-IP rate limits on /admin/* and the signup POST, and a daily cap on AI suggestions. The WAF is the primary perimeter.

import {
  ipKey,
  limit,
  limitedResponse,
  matchRule,
  mustStop,
} from "@dustinedwards/site-runtime/rate-limit";
import { OWASP_EVENTS, logEvent, requestFields } from "@dustinedwards/site-runtime/log";
import { kvCounter } from "@dustinedwards/site-runtime/ai-caps";
import { loadSettings, settingNum } from "~/lib/content.server";

// Per-IP 60-second windows counted by the RATE_LIMITER Durable Object; tunable via settings (ratelimit.*). A counter
// that is down lets the request through (logged): /admin sits behind Access, AI has its own cap, a signup is one row.
const RULES: Array<{
  path: string;
  prefix?: boolean;
  methods?: string[];
  bucket: string;
  settingKey: string;
  def: number;
}> = [
  { path: "/admin", prefix: true, bucket: "admin", settingKey: "ratelimit.admin", def: 150 },
  // Only the POST is metered (a script could fill the list); /subscribe.data is the same action.
  ...["/subscribe", "/subscribe.data"].map((path) => ({
    path,
    methods: ["POST"],
    bucket: "subscribe",
    settingKey: "ratelimit.subscribe",
    def: 5,
  })),
];

/** A 429 if rate-limited, else null; a refusal writes one OWASP `excess_rate_limit_exceeded` line. */
export async function enforceRateLimit(env: Env, request: Request): Promise<Response | null> {
  const match = matchRule(request, RULES);
  if (!match) return null;
  const max = settingNum(await loadSettings(env), match.settingKey, match.def);
  const verdict = await limit(
    env.RATE_LIMITER,
    ipKey(match.bucket, request).key,
    [{ limit: max, windowSeconds: 60 }],
    { onUnavailable: "allow" },
  );
  if (!mustStop(verdict, "allow")) return null;
  logEvent(
    OWASP_EVENTS.rateLimitExceeded,
    { ...requestFields(request, { status: 429 }), bucket: match.bucket },
    { level: "warn" },
  );
  return limitedResponse(verdict);
}

// Max AI suggestions per day (media/suggest.server.ts), so a stuck button cannot drain spend; ai.daily_cap setting.
const AI_DAILY_CAP_DEFAULT = 100;

const aiCounter = (env: Env) =>
  kvCounter(env.APP_KV, "ai:cap:", async () =>
    settingNum(await loadSettings(env), "ai.daily_cap", AI_DAILY_CAP_DEFAULT),
  );

export function aiCostCapExceeded(env: Env): Promise<boolean> {
  return aiCounter(env).exceeded();
}

export function recordAiUse(env: Env): Promise<void> {
  return aiCounter(env).record();
}
