// What the nightly dump must leave out and carry, for d1-dump's runCheckedBackup.
// NEVER IN A DUMP: they held live credentials or one-time tokens, and restoring a session revives old sign-ins:
//   session       Better Auth sessions: a bearer `token` per row, plus IP and user agent.
//   verification  Better Auth one-time sign-in and verification values.
//   account       the Google OAuth access, refresh and id tokens (and a password column).
//   preview_links Carrel's preview links (site-api's store): the hash of each link's token. Restoring an older copy
//                 would bring back a link revoked since; a lost link is made again in Carrel.
// drizzle/0010 drops the first three, so they go as `excludeIfPresent`; the standard check fails a dump that carries one.
export const BACKUP_EXCLUDE = ["session", "verification", "account", "preview_links"] as const;

// Credential-named columns the dump keeps, each with why; the credential-column check refuses any other.
export const CREDENTIAL_ALLOW: Record<string, string> = {
  "subscribers.unsubscribe_token":
    "a one-click unsubscribe link's token: it can only unsubscribe its own address, and a restore must keep it so the links in sent newsletters still work",
};

// Irreplaceable content: each must dump and match its live count; all empty fails, since the site always has settings and a show_config row.
export const BACKUP_COUNTED_TABLES = [
  "posts",
  "content_blocks",
  "settings",
  "show_config",
] as const;
