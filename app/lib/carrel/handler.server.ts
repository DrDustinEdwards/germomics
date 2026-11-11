// Carrel's site API, mounted by workers/app.ts at /api/carrel/v1, with its preview links at /preview/<token>. One key
// (CARREL_SITE_KEY, a Worker secret) reaches only that prefix and nothing else on the site. The same object runs the
// schedules Carrel set, from the one-minute cron (workers/app.ts).
import { standardSiteApi } from "@dustinedwards/site-api";
import { INDEXNOW_KEY, SITE_ORIGIN } from "~/lib/site";
import { createCarrelAdapter } from "./adapter.server";

/** `stylesheets`: the site's own, for a preview drawn as the site draws a post (workers/app.ts passes them). */
export function carrelApi(env: Env, stylesheets: () => Promise<string[]> = async () => []) {
  // The replay store (safe retries by change id), preview links, failed hooks' retries and the webmentions sent
  // (drizzle/0018_site_api_store.sql). The standard hooks: a changed live page tells IndexNow and the pages it links
  // to, whether a Carrel request or a schedule changed it, and a schedule (which has no request for the gateway to
  // purge after) purges the stored pages.
  return standardSiteApi({
    adapter: createCarrelAdapter(env, undefined, { stylesheets }),
    key: env.CARREL_SITE_KEY,
    limiter: env.CARREL_RATE_LIMIT,
    db: env.DB,
    indexNow: { origin: SITE_ORIGIN, key: INDEXNOW_KEY },
  });
}

/**
 * The per-minute cron's job (workers/app.ts): every schedule that is due goes live, with the hooks a Carrel publish
 * runs, hooks that failed earlier are tried again, and the trash past 30 days is emptied. A schedule that fails fails
 * the job, and is tried next minute.
 */
export async function runCarrelSchedules(env: Env, now: Date): Promise<void> {
  await carrelApi(env).runSchedulesOrThrow({ now });
}
