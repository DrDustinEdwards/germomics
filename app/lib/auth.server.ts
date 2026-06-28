// app/lib/auth.server.ts — the Better Auth instance, built per-request from env.
//
// On Workers, secrets live in context.cloudflare.env (not process.env), so auth is a factory:
// createAuth(env), called in the api.auth.$ handler and the admin middleware. Single admin:
// Google is the only provider and a user.create.before hook rejects any non-allowlisted email,
// so only ADMIN_EMAIL can ever have an account. Sessions live in KV (secondaryStorage), the
// four core tables in D1 via the Drizzle adapter.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { getDb, schema } from "~/db/index.server";

export function createAuth(env: Env) {
  const db = getDb(env);
  const adminEmail = env.ADMIN_EMAIL?.toLowerCase();

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: env.BETTER_AUTH_URL ? [env.BETTER_AUTH_URL] : [],

    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),

    // Sessions / verification / rate-limit counters → Cloudflare KV (APP_KV).
    // KV's minimum expirationTtl is 60s, so clamp upward.
    secondaryStorage: {
      get: (key) => env.APP_KV.get(key),
      set: async (key, value, ttl) => {
        await env.APP_KV.put(
          key,
          value,
          ttl ? { expirationTtl: Math.max(ttl, 60) } : undefined,
        );
      },
      delete: (key) => env.APP_KV.delete(key),
    },

    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },

    // Single-admin lock. For Google OAuth the email is only known at the callback, when
    // Better Auth tries to create the user — block creation of anyone but the admin, so the
    // allowlisted address is the only account that can ever exist (and thus ever sign in).
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (!adminEmail || user.email?.toLowerCase() !== adminEmail) {
              throw new APIError("FORBIDDEN", {
                message: "Germomics has a single administrator.",
              });
            }
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

/**
 * Resolve the current session and confirm it is the single admin. Returns null otherwise.
 * Used by the admin-route middleware (one gate for the whole admin.* subtree) and the login
 * screen (to bounce an already-signed-in admin to the dashboard).
 */
export async function getAdminSession(env: Env, request: Request) {
  const session = await createAuth(env).api.getSession({ headers: request.headers });
  if (!session) return null;
  const adminEmail = env.ADMIN_EMAIL?.toLowerCase();
  if (!adminEmail || session.user.email?.toLowerCase() !== adminEmail) return null;
  return session;
}
