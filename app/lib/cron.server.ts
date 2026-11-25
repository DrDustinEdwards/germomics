// The scheduled jobs, keyed by the cron that fires them (wrangler.jsonc triggers.crons). /health's cronCheck reads
// every list, so a job whose trigger never fires warns as "never ran".
// Every minute: scheduled posts go live, failed hooks rerun, the trash is emptied, the media backfill runs until done,
// stale renders are re-rendered. Each has 50 seconds so a hung one never runs into the next minute. Nightly jobs'
// timeouts add up to 18 minutes; the file passes stop a minute before theirs (timeBudgetMs in backup.server.ts).
import { backupJob, DAILY_MINUTES, type CronJob } from "@dustinedwards/site-runtime/cron";
import { logEvent } from "@dustinedwards/site-runtime/log";
import { pruneNotFoundJob } from "@dustinedwards/site-runtime/not-found";
import {
  runAudioBackup,
  runBackup,
  runGameAssetsBackup,
  runImagesBackup,
} from "~/lib/backup.server";
import { runCarrelSchedules } from "~/lib/carrel/handler.server";
import { continueMediaBackfill } from "~/lib/media/backfill.server";
import { runPageDates } from "~/lib/page-dates.server";
import { rerenderStale } from "~/lib/render.server";

const SCHEDULES_CRON = "* * * * *";
const NIGHTLY_CRON = "17 3 * * *";

const MINUTE = 60_000;

export function cronJobs(env: Env, scheduledTime: Date): Record<string, CronJob[]> {
  return {
    [SCHEDULES_CRON]: [
      {
        name: "schedules",
        everyMinutes: 1,
        timeoutMs: 50_000,
        run: () => runCarrelSchedules(env, scheduledTime),
      },
      {
        name: "media-backfill",
        everyMinutes: 1,
        timeoutMs: 50_000,
        run: () => continueMediaBackfill(env),
      },
      // Stale renders are stored within a minute of a deploy so the sitemap and feeds read current HTML; with none, two indexed reads.
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
      backupJob(() => runBackup(env), { timeoutMs: 4 * MINUTE }),
      backupJob(() => runAudioBackup(env), {
        name: "audio-backup",
        timeoutMs: 4 * MINUTE,
      }),
      backupJob(() => runImagesBackup(env), {
        name: "images-backup",
        timeoutMs: 4 * MINUTE,
      }),
      backupJob(() => runGameAssetsBackup(env), {
        name: "game-assets-backup",
        timeoutMs: 4 * MINUTE,
      }),
      // For /sitemap.xml's lastmod (page-dates.server.ts).
      {
        name: "page-dates",
        everyMinutes: DAILY_MINUTES,
        timeoutMs: 2 * MINUTE,
        run: () => runPageDates(env),
      },
      pruneNotFoundJob(env.DB, { days: 90 }),
    ],
  };
}

/** Every job of every cron, for /health's cronCheck and the operator API's run_job. The backup jobs are marked backup for Capsid Admin's back up now. */
export function allCronJobs(env: Env): CronJob[] {
  return Object.values(cronJobs(env, new Date())).flat();
}
