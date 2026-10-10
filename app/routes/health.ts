// /health — light liveness probe for uptime monitors. 200 when the Worker is up and D1 answers a
// trivial query; 503 if the DB ping fails. No caching, noindex, and no secrets/PII in the body.
import { sql } from "drizzle-orm";
import type { Route } from "./+types/health";
import { getEnv } from "~/lib/context.server";
import { getDb } from "~/db/index.server";
import { backupStatus } from "~/lib/backup.server";

export async function loader({ context }: Route.LoaderArgs) {
  let dbUp = false;
  try {
    await getDb(getEnv(context)).run(sql`select 1`);
    dbUp = true;
  } catch {
    dbUp = false;
  }
  // Age of the newest complete nightly dump. A stale or unreadable backup is a warning inside
  // this field, never a 503: the site is still up. Unauthenticated, so only last_ok, age_hours
  // and warning (no keys, no table names).
  const backup = await backupStatus(getEnv(context));
  return new Response(
    JSON.stringify({ ok: dbUp, db: dbUp ? "up" : "down", backup, time: new Date().toISOString() }),
    {
      status: dbUp ? 200 : 503,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}
