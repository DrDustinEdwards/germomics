// Cloudflare Access in front of /admin. Access authenticates the person, then forwards the request
// with a signed JWT in the Cf-Access-Jwt-Assertion header (and the same token in the CF_Authorization
// cookie). We never trust the header's presence: the signature is verified against the team's
// published keys with jose, the audience must be this application's AUD tag, and the email must be
// the one admin. Anything else is "not signed in". Same verifier as Carrel's.
// https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
//
// Config (Cloudflare dashboard variables, typed in app/worker-secrets.d.ts):
//   ACCESS_TEAM_DOMAIN  https://<team>.cloudflareaccess.com
//   ACCESS_AUD          the Access application's Audience (AUD) tag
//   ADMIN_EMAIL         the one allowed address (kept as a second check behind the Access policy)
// Unset team domain or AUD means nobody is admin: it fails closed.
import { createRemoteJWKSet, jwtVerify } from "jose";

export type AdminSession = { email: string };

// One key set per team domain. jose caches and refetches keys itself; this only avoids rebuilding
// the fetcher on every request. It holds public keys, never request state.
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function keySetFor(teamDomain: string) {
  let set = keySets.get(teamDomain);
  if (!set) {
    set = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    keySets.set(teamDomain, set);
  }
  return set;
}

function assertionOf(request: Request): string | null {
  const header = request.headers.get("Cf-Access-Jwt-Assertion");
  if (header) return header;
  // Access sets the header only on paths the application covers; the cookie rides every request
  // to the host, which is how an admin is recognised on a public page opened with ?preview.
  const cookie = request.headers.get("Cookie");
  const match = cookie?.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * The signed-in admin, or null. Never throws: a missing, malformed, expired, wrong-audience or
 * wrong-issuer token, an unreachable key endpoint, and a non-admin email all return null.
 */
export async function getAdminSession(env: Env, request: Request): Promise<AdminSession | null> {
  const adminEmail = env.ADMIN_EMAIL?.toLowerCase();
  const teamDomain = env.ACCESS_TEAM_DOMAIN?.replace(/\/+$/, "");
  const audience = env.ACCESS_AUD;

  // Local development has no Access in front of it. This is an explicit opt-in in .dev.vars, and
  // it only applies to a localhost URL, so a stray copy of it in production still does nothing.
  if (env.ACCESS_DEV_BYPASS === "1" && adminEmail && new URL(request.url).hostname === "localhost") {
    return { email: adminEmail };
  }

  if (!adminEmail || !teamDomain || !audience) return null;
  const token = assertionOf(request);
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, keySetFor(teamDomain), {
      issuer: teamDomain,
      audience,
    });
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
    if (!email || email !== adminEmail) return null;
    return { email };
  } catch {
    return null;
  }
}
