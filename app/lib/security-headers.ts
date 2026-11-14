// The Worker's side of germomics' security headers: the set (header-set.ts) on every response (pages, feeds, resource
// routes, redirects, errors; workers/app.ts applies it), and the Content-Security-Policy built from what the site
// really loads. Server-only.

import { pageSecurity } from "@dustinedwards/site-runtime/page-headers";
import { TRUSTED_TYPES_NAMES } from "@dustinedwards/site-runtime/trusted-types";

import { SECURITY_HEADERS } from "~/lib/header-set";
import { MEDIA_ORIGIN, OP3_ORIGIN } from "~/lib/site";

// Content-Security-Policy, enforced, built by site-runtime's buildContentSecurityPolicy. Inline scripts run by the
// page's nonce: React Router puts it on its hydration and streaming scripts, React on its own, root.tsx on the theme
// script, and the edge cache gives every reader a fresh one (site-runtime ./worker). Allowlist: self, the
// media/images subdomains and Cloudflare's Web Analytics beacon (which reports to this origin's /cdn-cgi/rum). The data
// pages' map is Enarratio's, drawn on the server, so no map host is listed. The only frames are the post players
// (`embeds`). Styles keep 'unsafe-inline' for TipTap (so the nonce stays off style-src, which would switch it off).
// Violations go to /csp-report, which the gateway logs through site-runtime's receiver, so Workers Logs hold anything the
// policy blocks. Trusted Types is enforced (site-runtime 0.132.0); what the registry entry still stages (default-src
// 'none') goes beside it as Content-Security-Policy-Report-Only (buildStagedPolicy) until the reports are quiet.
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
      // No connect sources beyond 'self': the player streams through <audio> (media-src), the admin's audio analysis
      // reads the File it was handed, and uploads post to /admin/upload. Measured in a browser 2026-11-14.
    },
    extraDirectives: [
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "manifest-src 'self'",
      "upgrade-insecure-requests",
    ],
    // The Trusted Types policies a page may create: the network's (site-runtime TRUSTED_TYPES_NAMES).
    trustedTypes: [...TRUSTED_TYPES_NAMES],
  }) as const;

/**
 * site-runtime's pageSecurity: the set on every response (never clobbering a header a route set), the policy above, its
 * Report-Only companion and the Reporting API endpoint. Images and feeds are Cross-Origin-Resource-Policy: cross-origin
 * (`corp`), since other sites embed them.
 */
export const security = pageSecurity({
  set: SECURITY_HEADERS,
  corp: true,
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
  staged: { denyUnlisted: true },
});
