// The header set (header-set.ts) on every response, applied by workers/app.ts, and the CSP built from what the site loads.

import { pageSecurity } from "@dustinedwards/site-runtime/page-headers";
import { TRUSTED_TYPES_NAMES } from "@dustinedwards/site-runtime/trusted-types";

import { SECURITY_HEADERS } from "~/lib/header-set";
import { MEDIA_ORIGIN, OP3_ORIGIN } from "~/lib/site";

// Enforced CSP from site-runtime's buildContentSecurityPolicy. Inline scripts run by the page's nonce, fresh per reader
// from the edge cache. Allowlist: self, the media/images subdomains and the Web Analytics beacon; the data pages' map is
// drawn on the server, so no map host. The only frames are the post players (`embeds`). Styles keep 'unsafe-inline' for
// inline style attributes (a nonce on style-src would switch it off). Violations go to /csp-report. Trusted Types is
// enforced; what the registry entry still stages (default-src 'none') ships as Report-Only (buildStagedPolicy).
const sitePolicy = (nonce: string | undefined) =>
  ({
    nonce,
    nonceStyles: false,
    cloudflareWebAnalytics: true,
    // Post players, loaded only on the reader's click; `embeds` delegates their features in the Permissions-Policy.
    embeds: true,
    sources: {
      style: ["'unsafe-inline'"],
      img: ["data:", "blob:", MEDIA_ORIGIN],
      media: ["blob:", MEDIA_ORIGIN, OP3_ORIGIN],
      font: ["data:"],
    },
    extraDirectives: [
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
      "manifest-src 'self'",
      "upgrade-insecure-requests",
    ],
    trustedTypes: [...TRUSTED_TYPES_NAMES],
  }) as const;

/** Images and feeds are Cross-Origin-Resource-Policy: cross-origin (`corp`), since other sites embed them. */
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
