// The scheduled jobs, keyed by the cron that fires them (wrangler.jsonc triggers.crons). workers/app.ts runs the list
// for the cron it receives through site-runtime's runJobs, and /health's cronCheck reads every list (their names and
// intervals only), so a job whose trigger never fires warns as "never ran".
//
// Every minute: what Carrel scheduled goes live, failed hooks run again and the trash past 30 days is emptied
// (site-api's runSchedules), then, until it has finished once, a batch of the media backfill. Each has 50 seconds, so a
// hung one never runs into the next minute's run. Nightly: the D1 backup, the re-render of the bodies a Prelum upgrade
// left on an older render (render.server.ts), the audio and image files beside the backup, and the 404 counts pruned
// to 90 days. Their timeouts add up to 15 minutes, a scheduled invocation's wall-clock limit; the file passes stop
// themselves a minute before theirs (FILES_BUDGET_MS) and go on from there the next night.
import type { CronJob } from "@dustinedwards/site-runtime/cron";
import { logEvent } from "@dustinedwards/site-runtime/log";
import { pruneNotFound } from "@dustinedwards/site-runtime/not-found";
import { runAudioBackup, runBackup, runImagesBackup } from "~/lib/backup.server";
import { runCarrelSchedules } from "~/lib/carrel/handler.server";
import { continueMediaBackfill } from "~/lib/media/backfill.server";
import { rerenderStale } from "~/lib/render.server";

const SCHEDULES_CRON = "* * * * *";
const NIGHTLY_CRON = "17 3 * * *";

const MINUTE = 60_000;
const DAY = 1440;

export function cronJobs(env: Env, scheduledTime: Date): Record<string, CronJob[]> {
  return {
    [SCHEDULES_CRON]: [
      { name: "schedules", everyMinutes: 1, timeoutMs: 50_000, run: () => runCarrelSchedules(env, scheduledTime) },
      { name: "media-backfill", everyMinutes: 1, timeoutMs: 50_000, run: () => continueMediaBackfill(env) },
      // A render a Prelum upgrade or a migration left stale is stored within a minute of the deploy, not the next
      // night, so the sitemap's pictures and the feeds read current HTML. With nothing stale it is two indexed reads.
      {
        name: "rerender-stale",
        everyMinutes: 1,
        timeoutMs: 50_000,
        run: async () => {
          const done = await rerenderStale(env);
          if (done.posts || done.pages) logEvent("render_stale", done);
        },
      },
    ],
    [NIGHTLY_CRON]: [
      { name: "backup", everyMinutes: DAY, timeoutMs: 4 * MINUTE, run: () => runBackup(env) },
      { name: "audio-backup", everyMinutes: DAY, timeoutMs: 4 * MINUTE, run: () => runAudioBackup(env) },
      { name: "images-backup", everyMinutes: DAY, timeoutMs: 4 * MINUTE, run: () => runImagesBackup(env) },
      { name: "prune-404", everyMinutes: DAY, timeoutMs: MINUTE, run: () => pruneNotFound(env.DB, { days: 90 }) },
    ],
  };
}

/** Every job of every cron, for /health's cronCheck (it reads names and intervals; `run` is never called). */
export function allCronJobs(env: Env): CronJob[] {
  return Object.values(cronJobs(env, new Date())).flat();
}
