// /api/operator: the operator API, the door Capsid Admin's backups reach the site through (site-runtime ./operator,
// one implementation on every site). POST {tool, args} with Authorization: Bearer OPERATOR_TOKEN runs a tool; GET with
// the same bearer lists them. The bearer is the whole boundary. This is not under /admin, so Access does not cover it.
//
// Tools: backup_status, the backup state read now (the same read as /health's backup field, which /health keeps for an
// hour), and backup_media, the files backup passes (app/lib/backup.server.ts) run now, copy only, so safe to repeat.
import { operatorResponse } from "@dustinedwards/site-runtime/operator";
import type { Route } from "./+types/api.operator";
import { backupFilesNow, backupStatus } from "~/lib/backup.server";
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
      backup_media: {
        description:
          "Runs the nightly files backup now: one pass each over the audio, the images and the game assets into the backups bucket " +
          "(files/audio/, files/images/ and files/game-assets/). Copy only; each pass goes on where its last stopped.",
        run: async () => ({ files: await backupFilesNow(env) }),
      },
    },
  });
}

export const loader = ({ request, context }: Route.LoaderArgs) => operator(request, getEnv(context));
export const action = ({ request, context }: Route.ActionArgs) => operator(request, getEnv(context));
