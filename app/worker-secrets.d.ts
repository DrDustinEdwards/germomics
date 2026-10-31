// Runtime vars set in the Cloudflare dashboard (and in .dev.vars for local dev), never in
// wrangler.jsonc, so `wrangler types` does not know about them. Merged into the generated global
// Env interface here so context.cloudflare.env.* stays typed.
interface Env {
  /** The germomics drafting routine's API trigger: https://api.anthropic.com/v1/claude_code/routines/trig_.../fire. */
  AI_ROUTINE_URL?: string;
  /** That trigger's token (claude.ai/code/routines). Unset leaves the draft buttons off. */
  AI_ROUTINE_TOKEN?: string;
  /** The one allowed admin address. Checked behind the Access policy as a second lock. */
  ADMIN_EMAIL: string;
  /** Carrel's key for /api/carrel/v1 (32 characters or more). Unset or short refuses every request. */
  CARREL_SITE_KEY?: string;
  /** Still read by app/lib/preview.server.ts to sign preview links, so keep the secret set. */
  BETTER_AUTH_SECRET?: string;
  /** https://<team>.cloudflareaccess.com. Unset means no one is admin (fails closed). */
  ACCESS_TEAM_DOMAIN?: string;
  /** The Cloudflare Access application's Audience (AUD) tag. Unset means no one is admin. */
  ACCESS_AUD?: string;
  /** "1" in .dev.vars only: treats a localhost request as the admin. Ignored on any other host. */
  ACCESS_DEV_BYPASS?: string;
  /** The deployed commit, written into the built config by vite.config.ts; empty for a local build. */
  DEPLOY_SHA?: string;
}
