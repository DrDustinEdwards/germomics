// Runtime vars set in the Cloudflare dashboard (and in .dev.vars for local dev), never in
// wrangler.jsonc, so `wrangler types` does not know about them. Merged into the generated global
// Env interface here so context.cloudflare.env.* stays typed.
interface Env {
  /** The main admin. Checked behind the Access policy as a second lock. */
  ADMIN_EMAIL: string;
  /** Co-owners, comma-separated: full use, no say over who is admin. */
  CO_OWNER_EMAILS?: string;
  /** Carrel's key for /api/carrel/v1 (32 characters or more). Unset or short refuses every request. */
  CARREL_SITE_KEY?: string;
  /** https://<team>.cloudflareaccess.com. Unset means no one is admin (fails closed). */
  ACCESS_TEAM_DOMAIN?: string;
  /** The Cloudflare Access application's Audience (AUD) tag. Unset means no one is admin. */
  ACCESS_AUD?: string;
  /** "1" in .dev.vars only: treats a localhost request as the admin. Ignored on any other host. */
  ACCESS_DEV_BYPASS?: string;
  /** The Anthropic key for the media suggestions (Claude Haiku 5.5, called straight at Anthropic). Unset: no suggestions. */
  ANTHROPIC_API_KEY?: string;
  /** The bearer for /api/operator (32 characters or more), the admin MCP Worker's API leg. Unset or short closes the route. */
  OPERATOR_TOKEN?: string;
  /** Hex HMAC key for the newsletter's confirmation links (site-runtime ./signed-token). Unset closes newsletter signup. */
  SUBSCRIBE_LINK_KEY?: string;
  /** The address the site's mail is sent from. Unset, with SEND_EMAIL, means no mail is sent (app/lib/newsletter.server.ts). */
  EMAIL_FROM?: string;
  /** Cloudflare Email Service's send_email binding, once wrangler.jsonc declares it (app/lib/newsletter.server.ts). */
  SEND_EMAIL?: SendEmail;
  /** Keys site-runtime's admin idle cookie (withAdminIdle `secret`). Minted by the deploy (devkit worker-deploy `generated-secrets`), never shown; unset, the admin paths fail (site-runtime 0.82 requires it). */
  ADMIN_IDLE_SECRET: string;
  /** "1" or "true" puts the site in maintenance: every path but /health answers the 503 page (site-runtime ./maintenance). Set in the dashboard. */
  MAINTENANCE?: string;
  /** The deployed commit, written into the built config by vite.config.ts; empty for a local build. */
  DEPLOY_SHA?: string;
}
