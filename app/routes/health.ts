// /health: site-runtime's healthResponse, 503 only when D1 does not answer. Warnings, never a 503: the newest complete
// nightly dump or either file pass (audio, images) older than 26 hours (all under `backup`), a bucket or APP_KV not
// answering, and a scheduled job that failed or stopped (`cron_runs`). `sha` is the deployed commit, which vite.config.ts
// writes from the Workers Builds build (a local build has none). No keys, table names or counts.
import { cronCheck } from "@dustinedwards/site-runtime/cron";
import { healthResponse, kvCheck, r2Check } from "@dustinedwards/site-runtime/health";
import type { Route } from "./+types/health";
import { getEnv } from "~/lib/context.server";
import { backupStatus } from "~/lib/backup.server";

export function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context);
  return healthResponse({
    ping: () => env.DB.prepare("select 1").first(),
    backup: () => backupStatus(env),
    sha: env.DEPLOY_SHA,
    checks: [
      { ...r2Check("audio", env.MEDIA), level: "warn" },
      { ...r2Check("images", env.BLOG_IMAGES), level: "warn" },
      { ...kvCheck("kv", env.APP_KV), level: "warn" },
      cronCheck(env.DB),
    ],
  });
}
