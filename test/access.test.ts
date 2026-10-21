import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { getAdminSession } from "~/lib/access.server";

// The token check itself (signature, audience, issuer, expiry) is site-runtime's and tested there.
// These are germomics' own parts: the one admin email, the cookie, the dev bypass, never throwing.
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

  it("refuses a token signed by a key that is not the team's", async () => {
    expect(await getAdminSession(env, req({ "Cf-Access-Jwt-Assertion": await token({ key: otherPrivateKey }) }))).toBeNull();
  });

  it("refuses a valid token for an email that is not the admin, or with no email", async () => {
    expect(await getAdminSession(env, req({ "Cf-Access-Jwt-Assertion": await token({ email: "someone@example.com" }) }))).toBeNull();
    const bare = await new SignJWT({})
      .setProtectedHeader({ alg: "RS256", kid: "k1" })
      .setIssuer(TEAM)
      .setAudience(AUD)
      .setExpirationTime("5m")
      .sign(privateKey);
    expect(await getAdminSession(env, req({ "Cf-Access-Jwt-Assertion": bare }))).toBeNull();
  });

  it("refuses everyone when no admin address is configured", async () => {
    const noAdmin = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD } as unknown as Env;
    expect(await getAdminSession(noAdmin, req({ "Cf-Access-Jwt-Assertion": await token() }))).toBeNull();
  });

  it("matches the admin address without regard to case", async () => {
    const shouty = { ADMIN_EMAIL: "Admin@Example.com", ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD } as unknown as Env;
    const session = await getAdminSession(shouty, req({ "Cf-Access-Jwt-Assertion": await token({ email: "ADMIN@example.COM" }) }));
    expect(session).toEqual({ email: ADMIN });
  });

  it("returns null, not a throw, when the team's keys cannot be fetched", async () => {
    const elsewhere = { ...env, ACCESS_TEAM_DOMAIN: "https://down-team.cloudflareaccess.com" } as unknown as Env;
    expect(await getAdminSession(elsewhere, req({ "Cf-Access-Jwt-Assertion": await token() }))).toBeNull();
  });

  it("honours the dev bypass on localhost only", async () => {
    const dev = { ADMIN_EMAIL: ADMIN, ACCESS_DEV_BYPASS: "1" } as unknown as Env;
    expect(await getAdminSession(dev, req({}, "http://localhost:5173/admin"))).toEqual({ email: ADMIN });
    expect(await getAdminSession(dev, req({}, "https://germomics.com/admin"))).toBeNull();
    // Any other value, or no admin address, is not the opt-in.
    const loose = { ADMIN_EMAIL: ADMIN, ACCESS_DEV_BYPASS: "true" } as unknown as Env;
    expect(await getAdminSession(loose, req({}, "http://localhost:5173/admin"))).toBeNull();
    expect(await getAdminSession({ ADMIN_EMAIL: ADMIN } as unknown as Env, req({}, "http://localhost:5173/admin"))).toBeNull();
    expect(await getAdminSession({ ACCESS_DEV_BYPASS: "1" } as unknown as Env, req({}, "http://localhost:5173/admin"))).toBeNull();
  });
});
