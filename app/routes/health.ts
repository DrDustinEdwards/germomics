// /health — light liveness probe for uptime monitors: site-runtime's healthResponse (200, or 503 when D1 does not
// answer a trivial query; no-store, noindex). The backup field is the newest nightly dump's age, never a 503.
import { healthResponse } from "@dustinedwards/site-runtime/health";
import { sql } from "drizzle-orm";
import type { Route } from "./+types/health";
import { getEnv } from "~/lib/context.server";
import { getDb } from "~/db/index.server";
import { backupStatus } from "~/lib/backup.server";

export function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context);
  return healthResponse({ ping: () => getDb(env).run(sql`select 1`), backup: () => backupStatus(env) });
}
