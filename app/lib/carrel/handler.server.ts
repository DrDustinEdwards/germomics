// Carrel's site API, mounted by workers/app.ts at /api/carrel/v1, with its preview links at /preview/<token>. One key
// (CARREL_SITE_KEY, a Worker secret) reaches only that prefix and nothing else on the site. The same object runs the
// schedules Carrel set, from the one-minute cron (workers/app.ts).
import { createSiteApi, indexNowHook, insidePrefix, PREVIEW_LINK_PATH, webmentionHook } from "@dustinedwards/site-api";
import { d1SiteApiStore } from "@dustinedwards/site-api/store";
import { schedulePurgeHook } from "@dustinedwards/site-runtime/edge-cache";
import { submitIndexNow } from "@drdustinedwards/site-helpers/indexnow";
import { INDEXNOW_KEY, SITE_ORIGIN } from "~/lib/site";
import { createCarrelAdapter } from "./adapter.server";

/** A request the site API or a preview link answers (or refuses): the only ones that load it. */
export const isCarrelRequest = (url: URL) => insidePrefix(url.pathname) || url.pathname.startsWith(PREVIEW_LINK_PATH);

/** `stylesheets`: the site's own, for a preview drawn as the site draws a post (workers/app.ts passes them). */
export function carrelApi(env: Env, stylesheets: () => Promise<string[]> = async () => []) {
  // The replay store (safe retries by change id), preview links, failed hooks' retries and the webmentions sent
  // (drizzle/0018_site_api_store.sql).
  const store = d1SiteApiStore(env.DB);
  return createSiteApi({
    adapter: createCarrelAdapter(env, undefined, { stylesheets }),
    key: env.CARREL_SITE_KEY,
    limiter: env.CARREL_RATE_LIMIT,
    log: (entry) => console.log(JSON.stringify(entry)),
    store,
    // A changed live page tells IndexNow and the pages it links to, whether a Carrel request or a schedule changed it:
    // under ctx.waitUntil for a request (workers/app.ts passes ctx), inside the cron pass for a schedule. A schedule has
    // no request for the gateway to purge after, so its change purges the stored pages here.
    hooks: [indexNowHook({ submit: submitIndexNow, origin: SITE_ORIGIN, key: INDEXNOW_KEY }), schedulePurgeHook(), webmentionHook({ store })],
  });
}

/**
 * The per-minute cron's job (workers/app.ts): every schedule that is due goes live, with the hooks a Carrel publish
 * runs, hooks that failed earlier are tried again, and the trash past 30 days is emptied. A schedule that fails fails
 * the job, and is tried next minute.
 */
export async function runCarrelSchedules(env: Env, now: Date): Promise<void> {
  const run = await carrelApi(env).runSchedules({ now });
  if (run.failed > 0) throw new Error(`${run.failed} Carrel schedule(s) failed`);
}
