// Every security header germomics sends, in one file: site-runtime's standard set (the OWASP Secure
// Headers Project's values) with this site's deviations, each beside its reason, and the
// Content-Security-Policy built from what the site really loads. workers/app.ts and the edge cache
// apply withSecurityHeaders to every response (pages, feeds, resource routes, redirects, errors).
// Server-only.

import { buildContentSecurityPolicy, reportingEndpoints } from "@dustinedwards/site-runtime/csp";
import { receiveCspReport } from "@dustinedwards/site-runtime/csp-report";
import { applyHeaderSet, buildSecurityHeaders, STANDARD_SECURITY_HEADERS } from "@dustinedwards/site-runtime/headers";
import { TDM_RESERVATION_HEADERS } from "@drdustinedwards/site-helpers/robots";

import { IMAGE_ORIGIN, MEDIA_ORIGIN, OP3_ORIGIN } from "~/lib/site";

// Content-Security-Policy, enforced, built by site-runtime's buildContentSecurityPolicy. Allowlist:
// self + cdnjs, the Maps JavaScript API, the media/images subdomains, and Cloudflare's Web Analytics
// beacon (which reports to this origin's /cdn-cgi/rum). The Maps hosts are the allowlist in Google's
// Maps JavaScript API CSP guide (googleapis.com and gstatic.com for script, image and connect, the
// Google Fonts pair for the map's Roboto, google.com frames), minus the legacy-domain entries this
// site does not load from. Scripts take inlineScripts: "unsafe-inline" because React Router streams
// inline hydration scripts and the pre-paint theme script is inline, and an edge-cached page cannot
// carry a nonce; style-src keeps 'unsafe-inline' for TipTap. Violations still go to CSP_REPORT_PATH,
// which logs them through site-runtime's receiver, so Workers Logs hold anything the policy blocks.
export const CSP_REPORT_PATH = "/csp-report";
const CSP_ENDPOINT = "csp-endpoint";
const MAPS_SCRIPT = ["https://*.googleapis.com", "https://*.gstatic.com"];
const MAPS_DATA = [...MAPS_SCRIPT, "https://*.google.com", "https://*.googleusercontent.com"];
const CSP = buildContentSecurityPolicy({
  inlineScripts: "unsafe-inline",
  cloudflareWebAnalytics: true,
  reportUri: CSP_REPORT_PATH,
  reportTo: CSP_ENDPOINT,
  sources: {
    script: ["https://cdnjs.cloudflare.com", ...MAPS_SCRIPT],
    style: ["'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
    img: ["data:", "blob:", IMAGE_ORIGIN, MEDIA_ORIGIN, ...MAPS_DATA],
    media: ["blob:", MEDIA_ORIGIN, OP3_ORIGIN],
    font: ["data:", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
    connect: [IMAGE_ORIGIN, MEDIA_ORIGIN, OP3_ORIGIN, ...MAPS_DATA, "blob:"],
  },
  extraDirectives: ["worker-src 'self' blob:", "child-src 'self' blob:", "frame-src 'self' https://*.google.com", "manifest-src 'self'", "upgrade-insecure-requests"],
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

// Added to every response (only if a route hasn't already set them), with Prelum's TDMRep header
// reserving training rights; robots.txt and /ai.txt carry the rest of the policy.
const STATIC_HEADERS: Record<string, string> = { ...SECURITY_HEADERS, ...TDM_RESERVATION_HEADERS };

/**
 * Return a copy of `response` with the security headers added. Never clobbers headers a route
 * already set (Content-Type, Cache-Control, Set-Cookie, its own CSP, etc.). `origin` is used
 * for the Reporting API endpoint.
 */
export function withSecurityHeaders(response: Response, origin: string): Response {
  const headers = new Headers(response.headers);
  applyHeaderSet(headers, STATIC_HEADERS, { overwrite: false });
  // The Reporting API's endpoint for report-to. reportingEndpoints refuses plain http off localhost
  // (a dev server on a LAN address), which a browser would ignore anyway, so that origin gets none.
  if (!headers.has("Reporting-Endpoints") && !/^http:\/\/(?!localhost|127\.0\.0\.1|\[::1\])/.test(origin)) {
    headers.set("Reporting-Endpoints", reportingEndpoints(CSP_ENDPOINT, new URL(CSP_REPORT_PATH, origin)));
  }
  // A route that declared its own policy keeps it.
  if (!headers.has("Content-Security-Policy") && !headers.has("Content-Security-Policy-Report-Only")) headers.set(CSP.name, CSP.value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * The report sink: the family's one receiver (@dustinedwards/site-runtime/csp-report). It logs each
 * violation as a trimmed JSON line (origin and path only, no address or user agent) to Workers Logs
 * and stores nothing. Per address, through the CSP_REPORT_RATE_LIMIT binding; without the binding a
 * report is dropped (still 204).
 */
export function handleCspReport(request: Request, env: Env): Promise<Response> {
  const allow = async (r: Request) =>
    Boolean(env.CSP_REPORT_RATE_LIMIT) &&
    (await env.CSP_REPORT_RATE_LIMIT.limit({ key: r.headers.get("cf-connecting-ip") || "anon" })).success;
  return receiveCspReport(request, { allow });
}
