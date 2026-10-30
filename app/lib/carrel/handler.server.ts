// Carrel's site API, mounted by workers/app.ts at /api/carrel/v1. One key (CARREL_SITE_KEY, a Worker
// secret) reaches only that prefix and nothing else on the site. The same object runs the updates
// Carrel scheduled on live articles, from the one-minute cron (workers/app.ts).
import { createSiteApi, indexNowHook } from "@dustinedwards/site-api";
import { schedulePurgeHook } from "@dustinedwards/site-runtime/edge-cache";
import { submitIndexNow } from "@drdustinedwards/site-helpers/indexnow";
import { INDEXNOW_KEY, SITE_ORIGIN } from "~/lib/site";
import { createCarrelAdapter } from "./adapter.server";

export function carrelApi(env: Env) {
  return createSiteApi({
    adapter: createCarrelAdapter(env),
    key: env.CARREL_SITE_KEY,
    limiter: env.CARREL_RATE_LIMIT,
    log: (entry) => console.log(JSON.stringify(entry)),
    // A changed live page tells IndexNow, whether a Carrel request or a schedule changed it: under
    // ctx.waitUntil for a request (workers/app.ts passes ctx), inside the cron pass for a schedule.
    // A schedule has no request for the gateway to purge after, so its change purges the stored pages here.
    hooks: [indexNowHook({ submit: submitIndexNow, origin: SITE_ORIGIN, key: INDEXNOW_KEY }), schedulePurgeHook()],
  });
}
