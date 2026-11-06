// The header set every germomics response carries: the family registry's entry for this site (site-runtime ./sites,
// whose deviations sit there beside their reasons) plus Prelum's TDMRep header reserving training rights (robots.txt
// and /ai.txt carry the rest of that policy). The Worker applies it (security-headers.ts) and site-runtime's
// site-runtime-headers bin writes public/_headers for the static files from the same entry, so both carry one set.
import { buildSecurityHeaders } from "@dustinedwards/site-runtime/headers";
import { germomics } from "@dustinedwards/site-runtime/sites";
import { TDM_RESERVATION_HEADERS } from "@drdustinedwards/site-helpers/robots";

export const SECURITY_HEADERS: Record<string, string> = { ...buildSecurityHeaders({ site: germomics }), ...TDM_RESERVATION_HEADERS };
