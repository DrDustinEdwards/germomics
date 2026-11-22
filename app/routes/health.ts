// /health: site-runtime's siteHealthResponse, 503 only when D1 does not answer, because without D1 no page renders: that is
// the one fail-level check (`ping`). Every binding below is level warn, since the site still serves its pages when one
// is down: the newest complete nightly dump or either file pass (audio, images) older than 26 hours (all under
// `backup`), a bucket, APP_KV, the Images binding, Workers AI, the last alt-text call (`ai-alt-text`, a failure kept in APP_KV until a call works), the Send Email binding (present, nothing sent) or the rate limiter's Durable Object not answering, and a
// scheduled job that failed, stopped or never ran (`cron_runs`, read against the Worker's own job lists). `sha` is the
// deployed commit, which CI's deploy passes as DEPLOY_SHA (a local build has none). No keys, table names or counts.
//
// Not probed: BACKUPS (the backup check reads it, so a dead bucket shows as a stale or failed backup), and the two rate
// limit bindings (CARREL_RATE_LIMIT, CSP_REPORT_RATE_LIMIT), which have no read that does not spend a request's count.
import {
  aiOutcomeCheck,
  durableObjectCheck,
  emailCheck,
  imagesCheck,
  kvCheck,
  r2Check,
  siteHealthResponse,
} from "@dustinedwards/site-runtime/health";
import type { Route } from "./+types/health";
import { getEnv } from "@dustinedwards/site-runtime/context";
import { backupStatus } from "~/lib/backup.server";
import { allCronJobs } from "~/lib/cron.server";

export function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context);
  return siteHealthResponse(env, {
    backup: () => backupStatus(env),
    jobs: allCronJobs(env),
    checks: [
      { ...r2Check("audio", env.MEDIA), level: "warn" },
      { ...r2Check("images", env.BLOG_IMAGES), level: "warn" },
      { ...r2Check("game-assets", env.GAME_ASSETS), level: "warn" },
      { ...kvCheck("kv", env.APP_KV), level: "warn" },
      imagesCheck("images-binding", env.IMAGES),
      emailCheck("email", env.SEND_EMAIL),
      // The last real alt-text call failed (a spend cap, a revoked key); no binding check proves that.
      aiOutcomeCheck("alt-text", env.APP_KV),
      durableObjectCheck("rate-limiter", env.RATE_LIMITER),
    ],
  });
}
