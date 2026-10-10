import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { getAdminSession } from "~/lib/access.server";

// Cloudflare Access in front of /admin: the verifier must accept exactly one kind of request, a
// token signed by the team's key, for this application's audience, issued by this team, not
// expired, carrying the admin's email. Every other case below must be refused.
const TEAM = "https://test-team.cloudflareaccess.com";
const AUD = "test-audience-tag";
const ADMIN = "admin@example.com";
const env = { ADMIN_EMAIL: ADMIN, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD } as unknown as Env;

let privateKey: CryptoKey;
let otherPrivateKey: CryptoKey;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  const other = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  otherPrivateKey = other.privateKey;
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256", use: "sig" };
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    if (url === `${TEAM}/cdn-cgi/access/certs`) {
      return new Response(JSON.stringify({ keys: [jwk] }), { headers: { "Content-Type": "application/json" } });
    }
    return new Response("not found", { status: 404 });
  });
});

afterEach(() => vi.clearAllMocks());

async function token(over: { aud?: string; iss?: string; email?: string; exp?: string | number; key?: CryptoKey } = {}) {
  return new SignJWT({ email: over.email ?? ADMIN })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuedAt()
    .setIssuer(over.iss ?? TEAM)
    .setAudience(over.aud ?? AUD)
    .setExpirationTime(over.exp ?? "5m")
    .sign(over.key ?? privateKey);
}

const req = (headers: Record<string, string> = {}, url = "https://germomics.com/admin") =>
  new Request(url, { headers });

describe("getAdminSession", () => {
  it("accepts a valid assertion header for the admin", async () => {
    const session = await getAdminSession(env, req({ "Cf-Access-Jwt-Assertion": await token() }));
    expect(session).toEqual({ email: ADMIN });
  });

  it("accepts the same token from the CF_Authorization cookie (public page with ?preview)", async () => {
    const session = await getAdminSession(env, req({ Cookie: `a=b; CF_Authorization=${await token()}` }));
    expect(session).toEqual({ email: ADMIN });
  });

  it("refuses a request with no assertion", async () => {
    expect(await getAdminSession(env, req())).toBeNull();
  });

  it("refuses a token for a different audience", async () => {
    expect(await getAdminSession(env, req({ "Cf-Access-Jwt-Assertion": await token({ aud: "someone-elses-app" }) }))).toBeNull();
  });

  it("refuses an expired token", async () => {
    const expired = await token({ exp: Math.floor(Date.now() / 1000) - 3600 });
    expect(await getAdminSession(env, req({ "Cf-Access-Jwt-Assertion": expired }))).toBeNull();
  });

  it("refuses a token from another issuer", async () => {
    expect(await getAdminSession(env, req({ "Cf-Access-Jwt-Assertion": await token({ iss: "https://evil.cloudflareaccess.com" }) }))).toBeNull();
  });

  it("refuses a token signed by a key that is not the team's", async () => {
    expect(await getAdminSession(env, req({ "Cf-Access-Jwt-Assertion": await token({ key: otherPrivateKey }) }))).toBeNull();
  });

  it("refuses a valid token for an email that is not the admin", async () => {
    expect(await getAdminSession(env, req({ "Cf-Access-Jwt-Assertion": await token({ email: "someone@example.com" }) }))).toBeNull();
  });

  it("refuses garbage in the header", async () => {
    expect(await getAdminSession(env, req({ "Cf-Access-Jwt-Assertion": "not.a.jwt" }))).toBeNull();
  });

  it("fails closed when the team domain or audience is not configured", async () => {
    const good = { "Cf-Access-Jwt-Assertion": await token() };
    expect(await getAdminSession({ ADMIN_EMAIL: ADMIN, ACCESS_AUD: AUD } as unknown as Env, req(good))).toBeNull();
    expect(await getAdminSession({ ADMIN_EMAIL: ADMIN, ACCESS_TEAM_DOMAIN: TEAM } as unknown as Env, req(good))).toBeNull();
  });

  it("honours the dev bypass on localhost only", async () => {
    const dev = { ADMIN_EMAIL: ADMIN, ACCESS_DEV_BYPASS: "1" } as unknown as Env;
    expect(await getAdminSession(dev, req({}, "http://localhost:5173/admin"))).toEqual({ email: ADMIN });
    expect(await getAdminSession(dev, req({}, "https://germomics.com/admin"))).toBeNull();
  });
});
