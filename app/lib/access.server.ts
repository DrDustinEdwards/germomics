// Cloudflare Access in front of /admin. The token check (signature by the team's keys, issuer,
// AUD, RS256, 60 s skew, header or CF_Authorization cookie) is @dustinedwards/site-runtime/access;
// what is germomics' is the one admin email, the localhost dev bypass, and never throwing.
//
// Config (Cloudflare dashboard variables, typed in app/worker-secrets.d.ts):
//   ACCESS_TEAM_DOMAIN  https://<team>.cloudflareaccess.com
//   ACCESS_AUD          the Access application's Audience (AUD) tag
//   ADMIN_EMAIL         the one allowed address (kept as a second check behind the Access policy)
// Unset team domain or AUD means nobody is admin: it fails closed.
import { verifyAccessRequest } from "@dustinedwards/site-runtime/access";

export type AdminSession = { email: string };

/**
 * The signed-in admin, or null. Never throws: a missing or refused token, an unreachable key
 * endpoint, and a non-admin email all return null, so a public page that checks for ?preview
 * still renders during an Access outage.
 */
export async function getAdminSession(env: Env, request: Request): Promise<AdminSession | null> {
  const adminEmail = env.ADMIN_EMAIL?.toLowerCase();

  // Local development has no Access in front of it. This is an explicit opt-in in .dev.vars, and
  // it only applies to a localhost URL, so a stray copy of it in production still does nothing.
  if (env.ACCESS_DEV_BYPASS === "1" && adminEmail && new URL(request.url).hostname === "localhost") {
    return { email: adminEmail };
  }
  if (!adminEmail) return null;

  try {
    // The cookie rides every request to the host, which is how an admin is recognized on a public
    // page opened with ?preview; Access sets the header only on paths the application covers.
    const verdict = await verifyAccessRequest(request, {
      teamDomain: env.ACCESS_TEAM_DOMAIN,
      audience: env.ACCESS_AUD,
      cookie: true,
    });
    if (!verdict.ok) return null;
    const email = typeof verdict.claims.email === "string" ? verdict.claims.email.toLowerCase() : "";
    return email && email === adminEmail ? { email } : null;
  } catch {
    return null;
  }
}
