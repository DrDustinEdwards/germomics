// Runtime vars set in the Cloudflare dashboard (and in .dev.vars for local dev), never in
// wrangler.jsonc, so `wrangler types` does not know about them. Merged into the generated global
// Env interface here so context.cloudflare.env.* stays typed. The ones every site has (ADMIN_EMAIL, the Access
// settings, OPERATOR_TOKEN, CARREL_SITE_KEY, ANTHROPIC_API_KEY, ADMIN_IDLE_SECRET, MAINTENANCE...) are site-runtime's
// SiteSecrets; this file keeps only germomics' own.
type SiteSecrets = import("@dustinedwards/site-runtime/worker").SiteSecrets;

interface Env extends SiteSecrets {
  /** Hex HMAC key for the newsletter's confirmation links (site-runtime ./signed-token). Unset closes newsletter signup. */
  SUBSCRIBE_LINK_KEY?: string;
  /** The address the site's mail is sent from. Unset, with SEND_EMAIL, means no mail is sent (app/lib/newsletter.server.ts). */
  EMAIL_FROM?: string;
  /** Cloudflare Email Service's send_email binding, once wrangler.jsonc declares it (app/lib/newsletter.server.ts). */
  SEND_EMAIL?: SendEmail;
  /** The deployed commit, written into the built config by vite.config.ts; empty for a local build. */
  DEPLOY_SHA?: string;
}
