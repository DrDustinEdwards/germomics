// Nightly D1 backup, run from the Worker's scheduled handler (wrangler.jsonc triggers.crons), by
// d1-dump's runCheckedBackup: dump without the marker, check, mark complete, prune. A dump that
// fails a check throws BackupIncomplete and keeps its objects without the marker, so the health age
// keeps growing toward its 26 hour warning. The episode audio (MEDIA) and the images (BLOG_IMAGES) are
// copied beside the dumps under files/audio/ and files/images/ by d1-dump's backupFiles, each run going
// on where the last stopped. Procedure and restore: CLAUDE.md "Backup".
import { backupFiles, backupHealth, filesHealth, runCheckedBackup } from "@dustinedwards/d1-dump";
import { BACKUP_COUNTED_TABLES, BACKUP_EXCLUDE, presentExcludes } from "~/lib/backup-checks";

const AUDIO_BACKUP = { name: "audio" };
const IMAGES_BACKUP = { name: "images" };

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
    counted: [...BACKUP_COUNTED_TABLES],
  });
}

export async function runAudioBackup(env: Env): Promise<void> {
  await backupFiles(env.MEDIA, env.BACKUPS, AUDIO_BACKUP);
}

export async function runImagesBackup(env: Env): Promise<void> {
  await backupFiles(env.BLOG_IMAGES, env.BACKUPS, IMAGES_BACKUP);
}

/** The newest complete dump and both file passes, for /health's backup check: it warns when any is stale. Never throws. */
export async function backupStatus(env: Env) {
  const [dump, audio, images] = await Promise.all([
    backupHealth(env.BACKUPS),
    filesHealth(env.BACKUPS, AUDIO_BACKUP),
    filesHealth(env.BACKUPS, IMAGES_BACKUP),
  ]);
  return { ...dump, files: { audio, images }, warning: dump.warning ?? audio.warning ?? images.warning };
}
