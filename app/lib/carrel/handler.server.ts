// Carrel's site API at /api/carrel/v1 and preview links at /preview/<token>. One key (CARREL_SITE_KEY) reaches only that prefix.
import { standardSiteApi } from "@dustinedwards/site-api";
import { INDEXNOW_KEY, SITE_ORIGIN } from "~/lib/site";
import { createCarrelAdapter, type RenderDocument } from "./adapter.server";

/** `renderDocument`: the site's own render of a route, for a preview drawn as the site draws a post (workers/app.ts). */
export function carrelApi(env: Env, renderDocument?: RenderDocument) {
  // Store: drizzle/0018. Hooks: a changed live page tells IndexNow and the pages it links to; a schedule has no request for the gateway to purge after, so it purges the stored pages itself.
  return standardSiteApi({
    adapter: createCarrelAdapter(env, undefined, { renderDocument }),
    key: env.CARREL_SITE_KEY,
    limiter: env.CARREL_RATE_LIMIT,
    db: env.DB,
    indexNow: { origin: SITE_ORIGIN, key: INDEXNOW_KEY },
  });
}

/** The per-minute cron job (workers/app.ts). A schedule that fails fails the job and is tried next minute. */
export async function runCarrelSchedules(env: Env, now: Date): Promise<void> {
  await carrelApi(env).runSchedulesOrThrow({ now });
}
