// The header set every germomics response carries: site-runtime's standard set (the OWASP Secure Headers Project's
// values) with this site's deviations, each beside its reason, plus Prelum's TDMRep header reserving training rights
// (robots.txt and /ai.txt carry the rest of that policy). The Worker applies it (security-headers.ts) and
// scripts/gen-headers.mjs writes it into public/_headers for the static files, so both carry one set. Package imports
// only: that script loads this file under plain Node.
import { buildSecurityHeaders, STANDARD_SECURITY_HEADERS } from "@dustinedwards/site-runtime/headers";
import { TDM_RESERVATION_HEADERS } from "@drdustinedwards/site-helpers/robots";

const OWASP_PERMISSIONS = (STANDARD_SECURITY_HEADERS["Permissions-Policy"] ?? "").split(",").map((d) => d.trim()).filter(Boolean);
const SELF_FEATURES = ["autoplay", "clipboard-write", "web-share"];

export const SECURITY_HEADERS: Record<string, string> = {
  ...buildSecurityHeaders({
    overrides: {
      "Permissions-Policy": {
        value: [
          ...OWASP_PERMISSIONS.filter((d) => !SELF_FEATURES.includes(d.split("=")[0] ?? "")),
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
    },
  }),
  ...TDM_RESERVATION_HEADERS,
};

// Cross-Origin-Resource-Policy stays same-origin except on what other origins embed: Carrel's preview, a sandboxed
// frame with an opaque origin, loads this site's stylesheets, fonts and images, and podcast apps and players load the
// feeds, transcripts and chapters. Every static file (public/_headers) and these Worker paths are cross-origin.
export const CROSS_ORIGIN = { "Cross-Origin-Resource-Policy": "cross-origin" };
export const isEmbeddedPath = (path: string) =>
  path.startsWith("/media/") || path.startsWith("/feed/") || path.endsWith("/transcript.vtt") || path.endsWith("/chapters.json");
