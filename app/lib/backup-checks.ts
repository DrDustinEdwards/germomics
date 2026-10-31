// What germomics' nightly dump must leave out and carry, for d1-dump's runCheckedBackup, whose standard
// checks (not empty, nothing excluded present, every counted table there with its live count, and not
// every counted table empty) are the whole check.
// NEVER IN A DUMP, because they held live credentials or one-time tokens. A backup copy is one
// more place a credential could leak from, and restoring a session revives old sign-ins:
//   session       Better Auth sessions: a bearer `token` per row, plus IP and user agent.
//   verification  Better Auth one-time sign-in and verification values.
//   account       the Google OAuth access, refresh and id tokens (and a password column).
//   preview_links Carrel's preview links (site-api's store): the hash of each link's token. Restoring an older copy
//                 would bring back a link revoked since; a lost link is made again in Carrel.
// drizzle/0010_retire_better_auth.sql drops the first three (with user). d1-dump fails a run on an excluded
// name that is not a table, so runBackup passes it only the names that exist at run time
// (presentExcludes); one that exists is excluded, and the standard check fails a dump that carries
// it. That holds whether the deploy or the migration lands first, and after both.
export const BACKUP_EXCLUDE = ["session", "verification", "account", "preview_links"] as const;

/** The credential tables to hand d1-dump as `exclude`: those in BACKUP_EXCLUDE that exist. */
export function presentExcludes(liveTables: Iterable<string>): string[] {
  const live = new Set(liveTables);
  return BACKUP_EXCLUDE.filter((name) => live.has(name));
}

// The irreplaceable content: each must be dumped and match its live count, read straight after the
// dump (d1-dump's `counted`), and a run where all of them dumped empty fails: the site always has
// settings and a show_config row.
export const BACKUP_COUNTED_TABLES = ["posts", "content_blocks", "settings", "show_config"] as const;
