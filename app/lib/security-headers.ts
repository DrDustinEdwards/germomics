// The Worker's side of germomics' security headers: the set (header-set.ts) on every response (pages, feeds, resource
// routes, redirects, errors; workers/app.ts and the edge cache apply it), and the Content-Security-Policy built from
// what the site really loads. Server-only.

import { buildContentSecurityPolicy, reportingEndpoints } from "@dustinedwards/site-runtime/csp";
import { receiveCspReport } from "@dustinedwards/site-runtime/csp-report";
import { applyHeaderSet } from "@dustinedwards/site-runtime/headers";

import { CROSS_ORIGIN, isEmbeddedPath, SECURITY_HEADERS } from "~/lib/header-set";
import { IMAGE_ORIGIN, MEDIA_ORIGIN, OP3_ORIGIN } from "~/lib/site";

// Content-Security-Policy, enforced, built by site-runtime's buildContentSecurityPolicy. Allowlist: self, the
// media/images subdomains, Cloudflare's Web Analytics beacon (which reports to this origin's /cdn-cgi/rum), and the
// hosts the data pages' map loads (DataMap.client.tsx, through @googlemaps/js-api-loader), named one by one from the
// API's own bootstrap rather than Google's wildcard list: its script and its JSONP services at maps.googleapis.com,
// tiles and map styles from maps.googleapis.com, images from maps.gstatic.com and mts.googleapis.com, its logging at
// www.google.com/maps/, and the Google Fonts pair for the map's Roboto. No street view, satellite or Google frame is
// used. Scripts keep inlineScripts: "unsafe-inline": React Router streams each page's loader data as inline scripts
// (streamController.enqueue), whose text changes with every page and edit, so no fixed hash covers them, and an
// edge-cached page cannot carry a nonce until it is rewritten per response. style-src keeps 'unsafe-inline' for
// TipTap and the map. Violations go to CSP_REPORT_PATH, which logs them through site-runtime's receiver, so Workers
// Logs hold anything the policy blocks.
export const CSP_REPORT_PATH = "/csp-report";
const CSP_ENDPOINT = "csp-endpoint";
const MAPS = "https://maps.googleapis.com";
const MAPS_DATA = [MAPS, "https://maps.gstatic.com", "https://mts.googleapis.com", "https://www.google.com/maps/"];
const CSP = buildContentSecurityPolicy({
  inlineScripts: "unsafe-inline",
  cloudflareWebAnalytics: true,
  reportUri: CSP_REPORT_PATH,
  reportTo: CSP_ENDPOINT,
  sources: {
    script: [`${MAPS}/maps/api/js`, `${MAPS}/maps/api/js/`, `${MAPS}/maps-api-v3/`],
    style: ["'unsafe-inline'", "https://fonts.googleapis.com"],
    img: ["data:", "blob:", IMAGE_ORIGIN, MEDIA_ORIGIN, ...MAPS_DATA],
    media: ["blob:", MEDIA_ORIGIN, OP3_ORIGIN],
    font: ["data:", "https://fonts.gstatic.com"],
    connect: [IMAGE_ORIGIN, MEDIA_ORIGIN, OP3_ORIGIN, ...MAPS_DATA, "blob:"],
  },
  extraDirectives: ["worker-src 'self' blob:", "child-src 'self' blob:", "manifest-src 'self'", "upgrade-insecure-requests"],
});

/**
 * Return a copy of `response` with the security headers added. Never clobbers headers a route
 * already set (Content-Type, Cache-Control, Set-Cookie, its own CSP, etc.). `url` is the request's:
 * its origin names the Reporting API endpoint, and its path decides Cross-Origin-Resource-Policy.
 */
export function withSecurityHeaders(response: Response, url: string): Response {
  const { origin, pathname } = new URL(url);
  const headers = new Headers(response.headers);
  applyHeaderSet(headers, isEmbeddedPath(pathname) ? { ...SECURITY_HEADERS, ...CROSS_ORIGIN } : SECURITY_HEADERS, { overwrite: false });
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
