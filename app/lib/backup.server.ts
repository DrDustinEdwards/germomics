// Nightly D1 backup, run from the Worker's scheduled handler (wrangler.jsonc triggers.crons), by
// d1-dump's runCheckedBackup: dump without the marker, check, mark complete, prune. A dump that
// fails a check throws BackupIncomplete and keeps its objects without the marker, so the health age
// keeps growing toward its 26 hour warning. Procedure and restore: CLAUDE.md "Backup".
import { backupHealth, runCheckedBackup } from "@dustinedwards/d1-dump";
import { getDb } from "~/db/index.server";
import { contentBlocks, posts, settings, showConfig } from "~/db/schema";
import { BACKUP_COUNTED_TABLES, BACKUP_EXCLUDE, presentExcludes, siteProblems } from "~/lib/backup-checks";

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

// Which of the credential tables exist right now (see BACKUP_EXCLUDE).
async function liveExcludes(env: Env): Promise<string[]> {
  const placeholders = BACKUP_EXCLUDE.map(() => "?").join(", ");
  const { results } = await env.DB.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${placeholders})`,
  )
    .bind(...BACKUP_EXCLUDE)
    .all<{ name: string }>();
  return presentExcludes(results.map((r) => r.name));
}

export async function runBackup(env: Env): Promise<void> {
  await runCheckedBackup(env.DB, env.BACKUPS, {
    exclude: await liveExcludes(env),
    required: [...BACKUP_COUNTED_TABLES],
    check: async (dump) => siteProblems(dump, await liveCounts(env)),
  });
}

/** Age of the newest complete dump, for /health. Never throws. */
export function backupStatus(env: Env) {
  return backupHealth(env.BACKUPS);
}
