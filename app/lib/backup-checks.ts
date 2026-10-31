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
// drizzle/0010_retire_better_auth.sql drops the first three (with user), so they go to d1-dump as
// `excludeIfPresent`: excluded while they exist, skipped once dropped, and the standard check fails a
// dump that carries one.
export const BACKUP_EXCLUDE = ["session", "verification", "account", "preview_links"] as const;

// Columns named like a credential that the dump keeps, each with why (d1-dump's credential-column
// check refuses any other).
export const CREDENTIAL_ALLOW: Record<string, string> = {
  "subscribers.unsubscribe_token":
    "a one-click unsubscribe link's token: it can only unsubscribe its own address, and a restore must keep it so the links in sent newsletters still work",
};

// The irreplaceable content: each must be dumped and match its live count, read straight after the
// dump (d1-dump's `counted`), and a run where all of them dumped empty fails: the site always has
// settings and a show_config row.
export const BACKUP_COUNTED_TABLES = ["posts", "content_blocks", "settings", "show_config"] as const;
