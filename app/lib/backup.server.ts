// Nightly D1 backup, run from the Worker's scheduled handler (wrangler.jsonc triggers.crons), by
// d1-dump's runCheckedBackup: dump without the marker, check, mark complete, prune. A dump that
// fails a check throws BackupIncomplete and keeps its objects without the marker, so the health age
// keeps growing toward its 26 hour warning. The credential tables are left out while they exist
// (`excludeIfPresent`), and the credential-column check refuses a dump that carries any other
// column named like a credential. The episode audio (MEDIA), the images (BLOG_IMAGES) and the game
// assets (GAME_ASSETS) are copied beside the dumps under files/audio/, files/images/ and
// files/game-assets/ by d1-dump's backupFiles, each run going
// on where the last stopped. Procedure and restore: CLAUDE.md "Backup".
//
// Not backed up, on purpose:
//   APP_KV                               the AI daily cap counter, the AI draft jobs and the media backfill's cursor:
//                                        losing it resets today's cap, drops unfinished drafts (made again on request)
//                                        and walks the bucket once more, which skips images already in `media`.
//   RATE_LIMITER (Durable Object)        per-address request counts in 60-second windows; gone within a minute anyway.
//   BACKUPS                              is the backup.
import { createSiteBackup } from "@dustinedwards/d1-dump";
import { BACKUP_COUNTED_TABLES, BACKUP_EXCLUDE, CREDENTIAL_ALLOW } from "~/lib/backup-checks";

// A file pass stops itself at three minutes and goes on the next night, inside its job's four-minute timeout
// (cron.server.ts). /health reports each pass by name under `files`: audio, images and game-assets.
const timeBudgetMs = 180_000;
const backup = createSiteBackup<Env>({
  dump: {
    excludeIfPresent: [...BACKUP_EXCLUDE],
    credentials: { allow: CREDENTIAL_ALLOW },
    counted: [...BACKUP_COUNTED_TABLES],
  },
  files: [
    { name: "audio", source: (env) => env.MEDIA, timeBudgetMs },
    { name: "images", source: (env) => env.BLOG_IMAGES, timeBudgetMs },
    { name: "game-assets", source: (env) => env.GAME_ASSETS, timeBudgetMs },
  ],
});

export const runBackup = async (env: Env): Promise<void> => void (await backup.runBackup(env));

// One pass each: the jobs run apart so each has its own four minutes.
const pass = async (env: Env, name: string) => (await backup.runFilesBackup(env, [name])).files[0];
export const runAudioBackup = (env: Env) => pass(env, "audio");
export const runImagesBackup = (env: Env) => pass(env, "images");
export const runGameAssetsBackup = (env: Env) => pass(env, "game-assets");

/** The newest complete dump and all three file passes, for /health's backup check: it warns when any is stale. Never throws. */
export const backupStatus = (env: Env) => backup.status(env);
