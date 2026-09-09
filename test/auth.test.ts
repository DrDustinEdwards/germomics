import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
// ?raw, not node:fs: this suite runs inside workerd, which has no filesystem. Vite inlines the
// module's source text at transform time, so the assertions below read the REAL file rather
// than a copy of it that could drift.
import AUTH_CLIENT_SOURCE from "~/lib/auth-client?raw";
import AUTH_SERVER_SOURCE from "~/lib/auth.server?raw";
import { createAuth, getAdminSession } from "~/lib/auth.server";

// THE AUTH SURFACE, pinned before better-auth is bumped.
//
// These are the safety net for the version bump in this PR, so they pin what the sign-in path
// IS rather than what a reader might assume it is. The distinction turned out to matter: the
// task doc recorded GHSA-qq9h-g4jm-xgf3 (pre-account hijacking on MAGIC-LINK and EMAIL-OTP
// sign-in) as reachable here on the grounds that "this repo uses app/lib/auth.server.ts, so the
// vulnerable flow is the one in use". That reasons from the module being imported rather than
// from which flows are configured, and it is wrong: this app configures Google social sign-in
// and nothing else. There is no magic link, no email OTP, no email-and-password, and therefore
// no signup form and no forgot-password flow to test.
//
// So the "signup" and "forgot-password" tests below assert that those surfaces DO NOT EXIST.
// That is not a placeholder for a missing test, it is the more useful assertion: it is the
// guard that goes red on the day somebody enables one of those flows, which is precisely the
// day this advisory becomes reachable and the bump stops being hygiene.

describe("login: Google is the only way in", () => {
  it("configures the google social provider from env", () => {
    const auth = createAuth(env as unknown as Env);
    const providers = auth.options.socialProviders ?? {};
    expect(Object.keys(providers)).toEqual(["google"]);
    expect(providers.google?.clientId).toBe("test-google-client-id");
  });

  it("configures NO other sign-in method", () => {
    const auth = createAuth(env as unknown as Env);
    // `in` rather than a property access, and that is not a style choice: better-auth infers
    // the options type from the literal it was handed, so `auth.options.emailAndPassword` is a
    // COMPILE error here. That is the type system stating the fact this test asserts, and the
    // check is kept anyway so the day someone adds either key, this goes red at runtime too.
    expect("emailAndPassword" in auth.options).toBe(false);
    expect("plugins" in auth.options).toBe(false);
  });

  it("binds the session store to KV and the tables to D1", () => {
    const auth = createAuth(env as unknown as Env);
    expect(auth.options.secondaryStorage).toBeTruthy();
    expect(auth.options.database).toBeTruthy();
    expect(auth.options.baseURL).toBe("http://localhost:5173");
  });
});

describe("signup and forgot-password: the surfaces do not exist", () => {
  // The reachability guard for GHSA-qq9h-g4jm-xgf3. If any of these go red, the advisory's
  // flows may now be live here and the finding needs re-rating before the next bump.
  it("the server config names no magic-link or email-OTP plugin", () => {
    for (const marker of ["magicLink", "magic-link", "emailOTP", "emailOtp", "email-otp"]) {
      expect(AUTH_SERVER_SOURCE, `auth.server.ts now references ${marker}`).not.toContain(marker);
    }
  });

  it("the server config enables no email-and-password sign-in", () => {
    expect(AUTH_SERVER_SOURCE).not.toContain("emailAndPassword");
  });

  it("the browser client exposes no signUp or password-reset call", () => {
    for (const marker of ["signUp", "forgetPassword", "forgotPassword", "resetPassword"]) {
      expect(AUTH_CLIENT_SOURCE, `auth-client.ts now exports ${marker}`).not.toContain(marker);
    }
    // NOT VACUOUS: the client really does export the three calls the admin login screen uses.
    for (const marker of ["signIn", "signOut", "useSession"]) {
      expect(AUTH_CLIENT_SOURCE).toContain(marker);
    }
  });
});

describe("the single-admin lock", () => {
  const hook = () => {
    const auth = createAuth(env as unknown as Env);
    const before = auth.options.databaseHooks?.user?.create?.before;
    if (!before) throw new Error("the user.create.before hook is gone; the single-admin lock is the only thing keeping accounts to one");
    return before;
  };

  it("refuses to create a user whose email is not the admin", async () => {
    await expect(hook()(({ email: "someone@example.com" }) as never)).rejects.toThrow(
      /single administrator/i,
    );
  });

  it("refuses case-tricked variants of a non-admin address", async () => {
    await expect(hook()(({ email: "Someone@Example.COM" }) as never)).rejects.toThrow();
  });

  it("allows the admin address, case-insensitively", async () => {
    // The other direction. A hook that threw for everyone would satisfy both tests above and
    // lock Dustin out of his own site.
    await expect(hook()(({ email: "ADMIN@example.com" }) as never)).resolves.not.toThrow();
  });
});

describe("session", () => {
  it("returns null when the request carries no session cookie", async () => {
    const session = await getAdminSession(env as unknown as Env, new Request("http://localhost:5173/admin"));
    expect(session).toBeNull();
  });

  it("returns null for a forged or malformed session cookie", async () => {
    const session = await getAdminSession(
      env as unknown as Env,
      new Request("http://localhost:5173/admin", { headers: { Cookie: "better-auth.session_token=not-a-real-token" } }),
    );
    expect(session).toBeNull();
  });
});
