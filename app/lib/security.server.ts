// Worker hardening — server-only (never import into client code). Three concerns:
//
//   1. The security-header layer applied to EVERY response in the Worker path (pages, feeds,
//      resource routes, redirects, errors). Lives here, not in root.tsx, so headers also cover
//      non-React responses (CLAUDE.md: prefer the Worker entry). CSP ships REPORT-ONLY first —
//      it reports violations without blocking, so TipTap (inline styles) and Google Maps (blob
//      workers, tiles) keep working while Dustin reviews real violations, then flips to enforce.
//   2. Per-IP rate limits on /admin/*, /admin/ai and the signup POST (site-runtime's limiter).
//   3. A per-day cost cap on the AI endpoint so spend can't run away.
//
// Cloudflare's WAF managed ruleset + bot rules are the primary perimeter defense (dashboard,
// see manual steps); this is the in-Worker layer the audit asked for.

import { buildContentSecurityPolicy, reportingEndpoints } from "@dustinedwards/site-runtime/csp";
import { applyHeaderSet, buildSecurityHeaders, STANDARD_SECURITY_HEADERS } from "@dustinedwards/site-runtime/headers";
import { ipKey, limit, limitedResponse, matchRule, mustStop } from "@dustinedwards/site-runtime/rate-limit";

import { IMAGE_ORIGIN, MEDIA_ORIGIN, OP3_ORIGIN } from "~/lib/site";

// ── Security headers ─────────────────────────────────────────────────────────

// Content-Security-Policy, REPORT-ONLY for now, built by site-runtime's buildContentSecurityPolicy.
// Allowlist: self + cdnjs, the Maps JS API (maps.googleapis.com serves executable script;
// maps.gstatic.com its images), the media/images subdomains, and Cloudflare's Web Analytics beacon
// (which reports to this origin's /cdn-cgi/rum). Scripts take inlineScripts: "unsafe-inline" because
// React Router streams inline hydration scripts and the pre-paint theme script is inline, and an
// edge-cached page cannot carry a nonce; style-src keeps 'unsafe-inline' for TipTap. Revisit at
// enforce. Violations go to CSP_REPORT_PATH, which logs them through site-runtime's receiver
// (workers/app.ts), so Workers Logs hold what the policy would block. Before enforcing, add only what
// those reports show (the Maps API may pull Roboto from Google Fonts on some surfaces); an entry
// nothing uses is a permission for no reason.
export const CSP_REPORT_PATH = "/csp-report";
const CSP_ENDPOINT = "csp-endpoint";
const CSP = buildContentSecurityPolicy({
  inlineScripts: "unsafe-inline",
  cloudflareWebAnalytics: true,
  reportOnly: true,
  reportUri: CSP_REPORT_PATH,
  reportTo: CSP_ENDPOINT,
  sources: {
    script: ["https://cdnjs.cloudflare.com", "https://maps.googleapis.com"],
    style: ["'unsafe-inline'", "https://cdnjs.cloudflare.com"],
    img: ["data:", "blob:", IMAGE_ORIGIN, MEDIA_ORIGIN, "https://maps.googleapis.com", "https://maps.gstatic.com"],
    media: ["blob:", MEDIA_ORIGIN, OP3_ORIGIN],
    font: ["data:", "https://cdnjs.cloudflare.com"],
    connect: [IMAGE_ORIGIN, MEDIA_ORIGIN, OP3_ORIGIN, "https://maps.googleapis.com"],
  },
  extraDirectives: ["worker-src 'self' blob:", "child-src 'self' blob:", "frame-src 'self'", "manifest-src 'self'", "upgrade-insecure-requests"],
});

// The family header set: OWASP's values from site-runtime, with germomics's deviations, each with its
// reason (buildSecurityHeaders refuses an override without one or one that restates the standard).
const OWASP_PERMISSIONS = (STANDARD_SECURITY_HEADERS["Permissions-Policy"] ?? "").split(",").map((d) => d.trim()).filter(Boolean);
const SELF_FEATURES = ["autoplay", "clipboard-write", "web-share"];
const SECURITY_HEADERS = buildSecurityHeaders({
  overrides: {
    "Permissions-Policy": {
      value: [
        ...OWASP_PERMISSIONS.filter((d) => !SELF_FEATURES.includes(d.split("=")[0])),
        ...SELF_FEATURES.map((f) => `${f}=(self)`),
        // Not in OWASP's list; this site denied it before adopting the set.
        ...(OWASP_PERMISSIONS.some((d) => d.startsWith("browsing-topics=")) ? [] : ["browsing-topics=()"]),
      ].join(", "),
      reason:
        "OWASP denies autoplay, clipboard-write and web-share; the player starts the next queued episode on `ended` and from lock-screen controls, and Copy link, the transcript quote and the feed-URL copy use the clipboard and the share sheet. Allowed for this origin only.",
    },
    "Referrer-Policy": {
      value: "strict-origin-when-cross-origin",
      reason:
        "OWASP's no-referrer strips the origin from the player's episode requests through OP3, which tells web players apart by Referer, and blanks Web Analytics' page-to-page referrers. Cross-origin requests still get the origin only, never the path.",
    },
    "Cross-Origin-Resource-Policy": {
      value: "cross-origin",
      reason: "Carrel's preview, a sandboxed frame on Carrel's own origin, loads this site's stylesheets and images",
    },
  },
});

// Added to every response (only if a route hasn't already set them). TDMRep (TDM Reservation
// Protocol): reserve text-and-data-mining / training rights and point at the machine-readable
// policy. robots.txt explicitly ALLOWS citation/search crawlers — the stronger, well-understood
// signal — so this only states the training-data preference.
const STATIC_HEADERS: Record<string, string> = { ...SECURITY_HEADERS, "tdm-reservation": "1" };

/**
 * Return a copy of `response` with the security headers added. Never clobbers headers a route
 * already set (Content-Type, Cache-Control, Set-Cookie, an enforced CSP, etc.). `origin` is used
 * for the absolute tdm-policy URL.
 */
export function withSecurityHeaders(response: Response, origin: string): Response {
  const headers = new Headers(response.headers);
  applyHeaderSet(headers, STATIC_HEADERS, { overwrite: false });
  if (!headers.has("tdm-policy")) headers.set("tdm-policy", `${origin}/ai.txt`);
  // The Reporting API's endpoint for report-to. reportingEndpoints refuses plain http off localhost
  // (a dev server on a LAN address), which a browser would ignore anyway, so that origin gets none.
  if (!headers.has("Reporting-Endpoints") && !/^http:\/\/(?!localhost|127\.0\.0\.1|\[::1\])/.test(origin)) {
    headers.set("Reporting-Endpoints", reportingEndpoints(CSP_ENDPOINT, new URL(CSP_REPORT_PATH, origin)));
  }
  // Only set report-only if no route already declared a (possibly enforced) policy.
  if (!headers.has("Content-Security-Policy") && !headers.has(CSP.name)) headers.set(CSP.name, CSP.value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ── Rate limiting (site-runtime's RateLimiter Durable Object) ────────────────

import { loadSettings, settingNum } from "~/lib/content.server";

// Per-IP fixed 60-second windows, counted exactly by the RATE_LIMITER Durable Object (the WAF
// rate-limit ruleset stays the hard control). Admin page navigation is generous; AI is tight.
// Per-minute limits are tunable live via the settings table (ratelimit.*), falling back to these
// defaults. A counter that is down lets the request through (logged by site-runtime): /admin sits
// behind Access, the AI endpoint has its own daily cap, and a signup is one row.
const RULES: Array<{ path: string; prefix?: boolean; methods?: string[]; bucket: string; settingKey: string; def: number; json: boolean }> = [
  { path: "/admin/ai", prefix: true, bucket: "ai", settingKey: "ratelimit.ai", def: 15, json: true },
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
