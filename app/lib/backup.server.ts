// Nightly D1 backup, run from the Worker's scheduled handler (wrangler.jsonc triggers.crons), by
// d1-dump's runCheckedBackup: dump without the marker, check, mark complete, prune. A dump that
// fails a check throws BackupIncomplete and keeps its objects without the marker, so the health age
// keeps growing toward its 26 hour warning. The credential tables are left out while they exist
// (`excludeIfPresent`), and the credential-column check refuses a dump that carries any other
// column named like a credential. The episode audio (MEDIA) and the images (BLOG_IMAGES) are
// copied beside the dumps under files/audio/ and files/images/ by d1-dump's backupFiles, each run going
// on where the last stopped. Procedure and restore: CLAUDE.md "Backup".
//
// Not backed up, on purpose:
//   GAME_ASSETS (germomics-game-assets)  art and sound for the games, served at /games/assets/*. The one game draws
//                                        with primitives and loads nothing from it yet; whatever is added is uploaded
//                                        from its source files, which are the copy. No reader data lives there.
//   APP_KV                               the AI daily cap counter, the AI draft jobs and the media backfill's cursor:
//                                        losing it resets today's cap, drops unfinished drafts (made again on request)
//                                        and walks the bucket once more, which skips images already in `media`.
//   RATE_LIMITER (Durable Object)        per-address request counts in 60-second windows; gone within a minute anyway.
//   BACKUPS                              is the backup.
import { backupFiles, backupHealth, filesHealth, runCheckedBackup } from "@dustinedwards/d1-dump";
import { BACKUP_COUNTED_TABLES, BACKUP_EXCLUDE, CREDENTIAL_ALLOW } from "~/lib/backup-checks";

// A file pass stops itself at three minutes and goes on the next night, inside its job's four-minute timeout
// (cron.server.ts).
const FILES_BUDGET_MS = 180_000;
const AUDIO_BACKUP = { name: "audio", timeBudgetMs: FILES_BUDGET_MS };
const IMAGES_BACKUP = { name: "images", timeBudgetMs: FILES_BUDGET_MS };

export async function runBackup(env: Env): Promise<void> {
  await runCheckedBackup(env.DB, env.BACKUPS, {
    excludeIfPresent: [...BACKUP_EXCLUDE],
    credentials: { allow: CREDENTIAL_ALLOW },
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
