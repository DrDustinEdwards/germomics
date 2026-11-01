// The Worker's side of germomics' security headers: the set (header-set.ts) on every response (pages, feeds, resource
// routes, redirects, errors; workers/app.ts applies it), and the Content-Security-Policy built from what the site
// really loads. Server-only.

import {
  buildContentSecurityPolicy,
  buildStagedPolicy,
  CSP_REPORT_GROUP,
  CSP_REPORT_PATH,
  reportingEndpoints,
} from "@dustinedwards/site-runtime/csp";
import { receiveCspReport } from "@dustinedwards/site-runtime/csp-report";
import { applyHeaderSet, corpFor } from "@dustinedwards/site-runtime/headers";

import { SECURITY_HEADERS } from "~/lib/header-set";
import { MEDIA_ORIGIN, OP3_ORIGIN } from "~/lib/site";

// Content-Security-Policy, enforced, built by site-runtime's buildContentSecurityPolicy. Inline scripts run by the
// page's nonce: React Router puts it on its hydration and streaming scripts, React on its own, root.tsx on the theme
// script, and the edge cache gives every reader a fresh one (renewNonce, edge-cache.server.ts). Allowlist: self, the
// media/images subdomains, Cloudflare's Web Analytics beacon (which reports to this origin's /cdn-cgi/rum), and the
// hosts the data pages' map loads (DataMap.client.tsx, through @googlemaps/js-api-loader), named one by one from the
// API's own bootstrap rather than Google's wildcard list: its loader, modules and JSONP services at maps.googleapis.com,
// tiles and map styles from maps.googleapis.com, images from maps.gstatic.com and mts.googleapis.com, its logging at
// www.google.com/maps/, and the Google Fonts pair for the map's Roboto. No street view or satellite is used, and the only
// frames are the post players (`embeds`). Styles keep 'unsafe-inline' for TipTap and the map (so the nonce stays off style-src, which would switch it
// off). Violations go to CSP_REPORT_PATH, which logs them through site-runtime's receiver, so Workers Logs hold
// anything the policy blocks. What the registry entry stages (Trusted Types, default-src 'none') goes beside it as
// Content-Security-Policy-Report-Only (buildStagedPolicy) until the reports are quiet.
export { CSP_REPORT_PATH };
const MAPS = "https://maps.googleapis.com";
// The JSONP services the API calls, each at its exact path: the prefix /maps/api/js/ also serves GeoPhotoService, a
// known allowlist bypass, which street view alone would need.
const MAPS_JSONP = ["AuthenticationService.Authenticate", "QuotaService.RecordEvent", "ApplicationService.GetEntityDetails", "StaticMapService.GetMapImage"];
const MAPS_DATA = [MAPS, "https://maps.gstatic.com", "https://mts.googleapis.com", "https://www.google.com/maps/"];
const sitePolicy = (nonce: string | undefined) =>
  ({
    nonce,
    nonceStyles: false,
    cloudflareWebAnalytics: true,
    // The post players a page may frame (YouTube, Spotify and the rest of Dustin's list), loaded only on the reader's click;
    // the registry entry's `embeds` opt-in delegates their features in the Permissions-Policy.
    embeds: true,
    sources: {
      script: [`${MAPS}/maps/api/js`, ...MAPS_JSONP.map((service) => `${MAPS}/maps/api/js/${service}`), `${MAPS}/maps-api-v3/`],
      style: ["'unsafe-inline'", "https://fonts.googleapis.com"],
      img: ["data:", "blob:", MEDIA_ORIGIN, ...MAPS_DATA],
      media: ["blob:", MEDIA_ORIGIN, OP3_ORIGIN],
      font: ["data:", "https://fonts.gstatic.com"],
      connect: [MEDIA_ORIGIN, OP3_ORIGIN, ...MAPS_DATA, "blob:"],
    },
    extraDirectives: ["worker-src 'self' blob:", "child-src 'self' blob:", "manifest-src 'self'", "upgrade-insecure-requests"],
  }) as const;
const csp = (nonce: string | undefined) => buildContentSecurityPolicy(sitePolicy(nonce));
// upgrade-insecure-requests stays in the enforced policy only: a browser ignores it in a Report-Only one, and says so.
const staged = (nonce: string | undefined) => {
  const site = sitePolicy(nonce);
  const extraDirectives = site.extraDirectives.filter((directive) => directive !== "upgrade-insecure-requests");
  return buildStagedPolicy({ ...site, extraDirectives }, { trustedTypes: true, denyUnlisted: true });
};

/**
 * Return a copy of `response` with the security headers added. Never clobbers headers a route
 * already set (Content-Type, Cache-Control, Set-Cookie, its own CSP, etc.). `url` is the request's,
 * whose origin names the Reporting API endpoint; `nonce` is the one the page was rendered with.
 * Images and feeds are Cross-Origin-Resource-Policy: cross-origin (corpFor), since other sites embed them.
 */
export function withSecurityHeaders(response: Response, url: string, nonce?: string): Response {
  const { origin } = new URL(url);
  const headers = new Headers(response.headers);
  applyHeaderSet(headers, { ...SECURITY_HEADERS, "Cross-Origin-Resource-Policy": corpFor(headers.get("Content-Type")) }, { overwrite: false });
  // The Reporting API's endpoint for report-to. reportingEndpoints refuses plain http off localhost
  // (a dev server on a LAN address), which a browser would ignore anyway, so that origin gets none.
  if (!headers.has("Reporting-Endpoints") && !/^http:\/\/(?!localhost|127\.0\.0\.1|\[::1\])/.test(origin)) {
    headers.set("Reporting-Endpoints", reportingEndpoints(CSP_REPORT_GROUP, new URL(CSP_REPORT_PATH, origin)));
  }
  // A route that declared its own policy keeps it.
  if (!headers.has("Content-Security-Policy") && !headers.has("Content-Security-Policy-Report-Only")) {
    for (const policy of [csp(nonce), staged(nonce)]) headers.set(policy.name, policy.value);
  }
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
