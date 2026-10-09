// Nightly D1 backup, run from the Worker's scheduled handler (wrangler.jsonc triggers.crons).
// d1-dump writes one JSON object per table into the BACKUPS R2 bucket and works where
// `wrangler d1 export` fails on our FTS5 tables. Procedure and restore: CLAUDE.md "Backup".
import { backupHealth, dumpDatabase, pruneDumps, writeCompleteMarker } from "@dustinedwards/d1-dump";
import { getDb } from "~/db/index.server";
import { contentBlocks, posts, settings, showConfig } from "~/db/schema";
import { BACKUP_EXCLUDE, dumpProblems } from "~/lib/backup-checks";

async function liveCounts(env: Env): Promise<Record<string, number>> {
  const db = getDb(env);
  const [p, c, s, sc] = await Promise.all([
    db.$count(posts),
    db.$count(contentBlocks),
    db.$count(settings),
    db.$count(showConfig),
  ]);
  return { posts: p, content_blocks: c, settings: s, show_config: sc };
}

/**
 * Dump, check, then mark complete. A dump that fails its checks is left WITHOUT the marker (it
 * is kept as evidence and never counts as the latest), and this throws so the failure shows in
 * Workers Logs and the health age keeps growing toward its 26 hour warning.
 */
export async function runBackup(env: Env): Promise<void> {
  const dump = await dumpDatabase(env.DB, env.BACKUPS, {
    exclude: [...BACKUP_EXCLUDE],
    markComplete: false,
  });
  const problems = dumpProblems(dump, await liveCounts(env));
  if (problems.length > 0) {
    throw new Error(`backup ${dump.run_id} left incomplete: ${problems.join("; ")}`);
  }
  await writeCompleteMarker(env.BACKUPS, dump);
  // d1-dump's default graduated retention: the newest complete run of each of the last 14 days,
  // 8 ISO weeks and 6 months; the newest complete run is never deleted.
  await pruneDumps(env.BACKUPS);
}

/** Age of the newest complete dump, for /health. Never throws. */
export function backupStatus(env: Env) {
  return backupHealth(env.BACKUPS);
}
