// Secret-only runtime vars — set as Cloudflare secrets (and in .dev.vars for local dev),
// never in wrangler.jsonc, so `wrangler types` does not know about them. Merged into the
// generated global Env interface here so context.cloudflare.env.* stays typed.
interface Env {
  BETTER_AUTH_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  ADMIN_EMAIL: string;
  /** Carrel's key for /api/carrel/v1 (32 characters or more). Unset or short refuses every request. */
  CARREL_SITE_KEY?: string;
  /** e.g. https://germomics.com — Better Auth base URL / trusted origin. */
  BETTER_AUTH_URL: string;
}
