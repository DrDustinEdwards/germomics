// The header set every germomics response carries: the family registry's entry for this site (site-runtime ./sites,
// whose deviations sit there beside their reasons) plus Prelum's TDMRep header reserving training rights (robots.txt
// and /ai.txt carry the rest of that policy). The Worker applies it (security-headers.ts) and scripts/gen-headers.mjs
// writes it into public/_headers for the static files, so both carry one set. Package imports only: that script loads
// this file under plain Node.
import { buildSecurityHeaders, permissionsAllowingSelf } from "@dustinedwards/site-runtime/headers";
import { germomics } from "@dustinedwards/site-runtime/sites";
import { TDM_RESERVATION_HEADERS } from "@drdustinedwards/site-helpers/robots";

export const SECURITY_HEADERS: Record<string, string> = {
  ...buildSecurityHeaders({ site: germomics }),
  // Not in the registry entry yet, and still used: the player starts the next queued episode on `ended` and from the
  // lock-screen controls (autoplay, player-context.tsx), Copy link, the transcript quote and the feed-URL copy write
  // to the clipboard (CopyLink, TranscriptPanel, subscribe), and Copy link opens the share sheet (navigator.share).
  // browsing-topics=() is not in OSHP's list; this site denied it before adopting the set.
  "Permissions-Policy": `${permissionsAllowingSelf("autoplay", "clipboard-write", "web-share")}, browsing-topics=()`,
  ...TDM_RESERVATION_HEADERS,
};
