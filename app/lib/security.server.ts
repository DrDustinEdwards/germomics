// Worker hardening — server-only (never import into client code). Three concerns:
//
//   1. The security-header layer applied to EVERY response in the Worker path (pages, feeds,
//      resource routes, redirects, errors). Lives here, not in root.tsx, so headers also cover
//      non-React responses (CLAUDE.md: prefer the Worker entry). CSP ships REPORT-ONLY first —
//      it reports violations without blocking, so TipTap (inline styles) and Google Maps (blob
//      workers, tiles) keep working while Dustin reviews real violations, then flips to enforce.
//   2. A best-effort KV sliding-window rate limiter on /admin/*, /admin/ai.
//   3. A per-day cost cap on the AI endpoint so spend can't run away.
//
// Cloudflare's WAF managed ruleset + bot rules are the primary perimeter defense (dashboard,
// see manual steps); this is the in-Worker layer the audit asked for.

import { IMAGE_ORIGIN, MEDIA_ORIGIN, OP3_ORIGIN } from "~/lib/site";

// ── Security headers ─────────────────────────────────────────────────────────

// Content-Security-Policy. REPORT-ONLY for now. Allowlist: self + cdnjs, the Maps JS API
// (maps.googleapis.com serves executable script; maps.gstatic.com its images), the media/images
// subdomains, and Cloudflare's Web Analytics beacon (which reports to this origin's /cdn-cgi/rum).
// script-src/style-src keep 'unsafe-inline' because React Router streams inline hydration scripts
// and the pre-paint theme script is inline (nonces aren't wired through RR8 streaming, and an
// edge-cached page cannot carry one); revisit at enforce. Violations go to CSP_REPORT_PATH, which
// logs them through site-runtime's receiver (workers/app.ts), so Workers Logs hold what the policy
// would block. Before enforcing, add only what those reports show (the Maps API may pull Roboto
// from Google Fonts on some surfaces); an entry nothing uses is a permission for no reason.
export const CSP_REPORT_PATH = "/csp-report";
const CSP_ENDPOINT = "csp-endpoint";
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://static.cloudflareinsights.com https://maps.googleapis.com",
  "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
  `img-src 'self' data: blob: ${IMAGE_ORIGIN} ${MEDIA_ORIGIN} https://maps.googleapis.com https://maps.gstatic.com`,
  `media-src 'self' blob: ${MEDIA_ORIGIN} ${OP3_ORIGIN}`,
  "font-src 'self' data: https://cdnjs.cloudflare.com",
  `connect-src 'self' ${IMAGE_ORIGIN} ${MEDIA_ORIGIN} ${OP3_ORIGIN} https://maps.googleapis.com`,
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-src 'self'",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
  `report-uri ${CSP_REPORT_PATH}`,
  `report-to ${CSP_ENDPOINT}`,
].join("; ");

// Static headers added to every response (only if a route hasn't already set them).
const STATIC_HEADERS: Record<string, string> = {
  // HSTS: 1 year + subdomains. No `preload` until after the custom-domain cutover (manual step).
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), browsing-topics=(), payment=(), usb=()",
  // TDMRep (TDM Reservation Protocol): reserve text-and-data-mining / training rights and point
  // at the machine-readable policy. robots.txt explicitly ALLOWS citation/search crawlers — the
  // stronger, well-understood signal — so this only states the training-data preference.
  "tdm-reservation": "1",
};

/**
 * Return a copy of `response` with the security headers added. Never clobbers headers a route
 * already set (Content-Type, Cache-Control, Set-Cookie, an enforced CSP, etc.). `origin` is used
 * for the absolute tdm-policy URL.
 */
export function withSecurityHeaders(response: Response, origin: string): Response {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(STATIC_HEADERS)) {
    if (!headers.has(k)) headers.set(k, v);
  }
  if (!headers.has("tdm-policy")) headers.set("tdm-policy", `${origin}/ai.txt`);
  // The Reporting API's endpoint for report-to. Absolute: a relative endpoint is ignored.
  if (!headers.has("Reporting-Endpoints")) headers.set("Reporting-Endpoints", `${CSP_ENDPOINT}="${origin}${CSP_REPORT_PATH}"`);
  // Only set report-only if no route already declared a (possibly enforced) policy.
  if (
    !headers.has("Content-Security-Policy") &&
    !headers.has("Content-Security-Policy-Report-Only")
  ) {
    headers.set("Content-Security-Policy-Report-Only", CSP);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ── Rate limiting (KV sliding window, best-effort) ───────────────────────────

import { loadSettings, settingNum } from "~/lib/content.server";

type Limit = { limit: number; windowSec: number };

// Per-IP windows. Admin page navigation is generous; auth + AI are tight. (The KV read-modify-
// write isn't atomic, so counts can slightly undercount under burst — fine for abuse mitigation;
// the WAF rate-limit ruleset is the hard control.)
// Per-minute limits are tunable live via the settings table (ratelimit.*), falling back to these
// defaults. Window is fixed at 60s.
const RULES: Array<{ test: (p: string, method: string) => boolean; bucket: string; settingKey: string; def: number; json: boolean }> = [
  { test: (p) => p.startsWith("/admin/ai"), bucket: "ai", settingKey: "ratelimit.ai", def: 15, json: true },
  { test: (p) => p.startsWith("/admin"), bucket: "admin", settingKey: "ratelimit.admin", def: 150, json: false },
  // A signup stores an address, so a script could fill the list (Grok audit 2026-10-21, GE-6).
  // Only the POST is metered; reading the page is not. /subscribe.data is the same action.
  { test: (p, m) => m === "POST" && (p === "/subscribe" || p === "/subscribe.data"), bucket: "subscribe", settingKey: "ratelimit.subscribe", def: 5, json: false },
];

async function overLimit(env: Env, key: string, { limit, windowSec }: Limit): Promise<boolean> {
  const window = Math.floor(Date.now() / 1000 / windowSec);
  const kvKey = `rl:${key}:${window}`;
  const current = Number(await env.APP_KV.get(kvKey)) || 0;
  if (current >= limit) return true;
  await env.APP_KV.put(kvKey, String(current + 1), { expirationTtl: windowSec + 5 });
  return false;
}

function tooMany(retrySec: number, json: boolean): Response {
  const body = json
    ? JSON.stringify({ ok: false, error: "Too many requests. Slow down and try again shortly." })
    : "Too many requests.";
  return new Response(body, {
    status: 429,
    headers: {
      "Content-Type": json ? "application/json; charset=utf-8" : "text/plain; charset=utf-8",
      "Retry-After": String(retrySec),
    },
  });
}

/** Returns a 429 Response if this request is rate-limited, otherwise null. */
export async function enforceRateLimit(env: Env, request: Request): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  const match = RULES.find((r) => r.test(pathname, request.method));
  if (!match) return null;
  const limit = settingNum(await loadSettings(env), match.settingKey, match.def);
  const ip = request.headers.get("cf-connecting-ip") || "anon";
  if (await overLimit(env, `${match.bucket}:${ip}`, { limit, windowSec: 60 })) {
    return tooMany(60, match.json);
  }
  return null;
}

// ── AI per-day cost cap ──────────────────────────────────────────────────────

// Max AI generations/day across the single admin. Approximates a spend cap (generations, not
// dollars). Tunable live via the ai.daily_cap setting.
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
