import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AccessStub, stubAccess } from "@dustinedwards/devkit/access";
import { getAdminSession } from "~/lib/access.server";

// germomics' part of the /admin check: the one admin email, the localhost dev bypass, and never throwing. The token
// checks themselves (signature, audience, issuer, expiry, header or cookie) are site-runtime's and tested there.
const TEAM = "https://test-team.cloudflareaccess.com";
const AUD = "test-audience-tag";
const ADMIN = "admin@example.com";
const env = { ADMIN_EMAIL: ADMIN, ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD } as unknown as Env;

let access: AccessStub;
beforeAll(async () => {
  access = await stubAccess({ issuer: TEAM, audience: AUD, email: ADMIN, jwksUrl: `${TEAM}/cdn-cgi/access/certs` });
});
afterAll(() => access.restore());

const req = (headers: Record<string, string> = {}, url = "https://germomics.com/admin") => new Request(url, { headers });

describe("getAdminSession", () => {
  it("admits the admin, matching the address without regard to case", async () => {
    expect(await getAdminSession(env, req({ "Cf-Access-Jwt-Assertion": await access.token() }))).toEqual({ email: ADMIN });
    const shouty = { ...env, ADMIN_EMAIL: "Admin@Example.com" } as unknown as Env;
    const token = await access.token({ email: "ADMIN@example.COM" });
    expect(await getAdminSession(shouty, req({ "Cf-Access-Jwt-Assertion": token }))).toEqual({ email: ADMIN });
  });

  it("refuses a valid token for anyone else, and everyone when no admin address is set", async () => {
    const other = await access.token({ email: "someone@example.com" });
    expect(await getAdminSession(env, req({ "Cf-Access-Jwt-Assertion": other }))).toBeNull();
    const noAdmin = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD } as unknown as Env;
    expect(await getAdminSession(noAdmin, req({ "Cf-Access-Jwt-Assertion": await access.token() }))).toBeNull();
  });

  it("honors the dev bypass on localhost only", async () => {
    const dev = { ADMIN_EMAIL: ADMIN, ACCESS_DEV_BYPASS: "1" } as unknown as Env;
    expect(await getAdminSession(dev, req({}, "http://localhost:5173/admin"))).toEqual({ email: ADMIN });
    expect(await getAdminSession(dev, req({}, "https://germomics.com/admin"))).toBeNull();
    // Any other value, or no admin address, is not the opt-in.
    const loose = { ADMIN_EMAIL: ADMIN, ACCESS_DEV_BYPASS: "true" } as unknown as Env;
    expect(await getAdminSession(loose, req({}, "http://localhost:5173/admin"))).toBeNull();
    expect(await getAdminSession({ ACCESS_DEV_BYPASS: "1" } as unknown as Env, req({}, "http://localhost:5173/admin"))).toBeNull();
  });

  it("returns null rather than throwing when the team's keys cannot be fetched", async () => {
    const elsewhere = { ...env, ACCESS_TEAM_DOMAIN: "https://unreachable.cloudflareaccess.com" } as unknown as Env;
    expect(await getAdminSession(elsewhere, req({ "Cf-Access-Jwt-Assertion": await access.token() }))).toBeNull();
  });
});
