// The Worker's side of germomics' security headers: the set (header-set.ts) on every response (pages, feeds, resource
// routes, redirects, errors; workers/app.ts applies it), and the Content-Security-Policy built from what the site
// really loads. Server-only.

import { CSP_REPORT_PATH } from "@dustinedwards/site-runtime/csp";
import { receiveCspReport } from "@dustinedwards/site-runtime/csp-report";
import { pageSecurity } from "@dustinedwards/site-runtime/page-headers";
import { TRUSTED_TYPES_NAMES } from "@dustinedwards/site-runtime/trusted-types";

import { SECURITY_HEADERS } from "~/lib/header-set";
import { MEDIA_ORIGIN, OP3_ORIGIN } from "~/lib/site";

// Content-Security-Policy, enforced, built by site-runtime's buildContentSecurityPolicy. Inline scripts run by the
// page's nonce: React Router puts it on its hydration and streaming scripts, React on its own, root.tsx on the theme
// script, and the edge cache gives every reader a fresh one (`renew` below). Allowlist: self, the
// media/images subdomains and Cloudflare's Web Analytics beacon (which reports to this origin's /cdn-cgi/rum). The data
// pages' map is Enarratio's, drawn on the server, so no map host is listed. The only frames are the post players
// (`embeds`). Styles keep 'unsafe-inline' for TipTap (so the nonce stays off style-src, which would switch it off).
// Violations go to CSP_REPORT_PATH, which logs them through site-runtime's receiver, so Workers Logs hold anything the
// policy blocks. What the registry entry stages (Trusted Types, default-src 'none') goes beside it as
// Content-Security-Policy-Report-Only (buildStagedPolicy) until the reports are quiet.
export { CSP_REPORT_PATH };
const sitePolicy = (nonce: string | undefined) =>
  ({
    nonce,
    nonceStyles: false,
    cloudflareWebAnalytics: true,
    // The post players a page may frame (YouTube, Spotify and the rest of Dustin's list), loaded only on the reader's click;
    // the registry entry's `embeds` opt-in delegates their features in the Permissions-Policy.
    embeds: true,
    sources: {
      style: ["'unsafe-inline'"],
      img: ["data:", "blob:", MEDIA_ORIGIN],
      media: ["blob:", MEDIA_ORIGIN, OP3_ORIGIN],
      font: ["data:"],
      connect: [MEDIA_ORIGIN, OP3_ORIGIN, "blob:"],
    },
    extraDirectives: [
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "manifest-src 'self'",
      "upgrade-insecure-requests",
    ],
  }) as const;

/**
 * site-runtime's pageSecurity: the set on every response (never clobbering a header a route set), the policy above, its
 * Report-Only companion and the Reporting API endpoint. Images and feeds are Cross-Origin-Resource-Policy: cross-origin
 * (`corp`), since other sites embed them. `renew`: a page stored at the edge gets a fresh nonce per reader.
 */
export const security = pageSecurity({
  set: SECURITY_HEADERS,
  corp: true,
  renew: true,
  // upgrade-insecure-requests stays in the enforced policy only: a browser ignores it in a Report-Only one, and says so.
  policy: ({ nonce, staged }) => {
    const site = sitePolicy(nonce);
    return staged
      ? {
          ...site,
          extraDirectives: site.extraDirectives.filter((d) => d !== "upgrade-insecure-requests"),
        }
      : site;
  },
  // The Trusted Types policies a page may create: the network's (site-runtime TRUSTED_TYPES_NAMES) and no other.
  // Hydrate on intent needs none: React Router's boot waits as JSON and loads with import() (site-runtime ./deferred-scripts).
  staged: { trustedTypes: [...TRUSTED_TYPES_NAMES], denyUnlisted: true },
});

/**
 * The report sink: the family's one receiver (@dustinedwards/site-runtime/csp-report). It logs each
 * violation as a trimmed JSON line (origin and path only, no address or user agent) to Workers Logs
 * and stores nothing. Per address, through the CSP_REPORT_RATE_LIMIT binding; without the binding a
 * report is dropped (still 204).
 */
export function handleCspReport(request: Request, env: Env): Promise<Response> {
  const allow = async (r: Request) =>
    Boolean(env.CSP_REPORT_RATE_LIMIT) &&
    (await env.CSP_REPORT_RATE_LIMIT.limit({ key: r.headers.get("cf-connecting-ip") || "anon" }))
      .success;
  return receiveCspReport(request, { allow });
}
