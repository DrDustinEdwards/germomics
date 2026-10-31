// Runtime vars set in the Cloudflare dashboard (and in .dev.vars for local dev), never in
// wrangler.jsonc, so `wrangler types` does not know about them. Merged into the generated global
// Env interface here so context.cloudflare.env.* stays typed.
interface Env {
  /** The one allowed admin address. Checked behind the Access policy as a second lock. */
  ADMIN_EMAIL: string;
  /** Carrel's key for /api/carrel/v1 (32 characters or more). Unset or short refuses every request. */
  CARREL_SITE_KEY?: string;
  /** https://<team>.cloudflareaccess.com. Unset means no one is admin (fails closed). */
  ACCESS_TEAM_DOMAIN?: string;
  /** The Cloudflare Access application's Audience (AUD) tag. Unset means no one is admin. */
  ACCESS_AUD?: string;
  /** "1" in .dev.vars only: treats a localhost request as the admin. Ignored on any other host. */
  ACCESS_DEV_BYPASS?: string;
  /** The deployed commit, written into the built config by vite.config.ts; empty for a local build. */
  DEPLOY_SHA?: string;
}
