// /api/operator: the operator API, the door Capsid Admin's backups reach the site through (site-runtime ./operator,
// one implementation on every site). POST {tool, args} with Authorization: Bearer OPERATOR_TOKEN runs a tool; GET with
// the same bearer lists them. The bearer is the whole boundary. This is not under /admin, so Access does not cover it.
//
// Tools: backup_status, the backup state read now (the same read as /health's backup field, which /health keeps for an
// hour), and run_job, any of the site's scheduled jobs run now through the code its cron runs (app/lib/cron.server.ts,
// site-runtime runJobTool), recorded in cron_runs as the cron records it; { backup: true } runs the four backup jobs.
import { operatorResponse } from "@dustinedwards/site-runtime/operator";
import type { Route } from "./+types/api.operator";
import { runJobTool } from "@dustinedwards/site-runtime/cron";
import { backupStatus } from "~/lib/backup.server";
import { allCronJobs } from "~/lib/cron.server";
import { getEnv } from "~/lib/context.server";

function operator(request: Request, env: Env) {
  return operatorResponse(request, {
    token: env.OPERATOR_TOKEN,
    limiter: env.RATE_LIMITER,
    tools: {
      backup_status: {
        description:
          "Reads the backup state now, uncached: the newest complete D1 dump's age and each files pass (audio, images, game assets) " +
          "with when it last completed, and a warning when any is past 26 hours. The same read as /health's backup field.",
        run: () => backupStatus(env),
      },
      run_job: runJobTool(env.DB, () => allCronJobs(env)),
    },
  });
}

export const loader = ({ request, context }: Route.LoaderArgs) => operator(request, getEnv(context));
export const action = ({ request, context }: Route.ActionArgs) => operator(request, getEnv(context));
