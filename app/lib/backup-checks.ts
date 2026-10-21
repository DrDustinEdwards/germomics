// What germomics' nightly dump must leave out and carry, for d1-dump's runCheckedBackup, which runs the
// standard checks (not empty, nothing excluded present, every required table there) and the ones here.
// NEVER IN A DUMP, because they held live credentials or one-time tokens. A backup copy is one
// more place a credential could leak from, and restoring a session revives old sign-ins:
//   session       Better Auth sessions: a bearer `token` per row, plus IP and user agent.
//   verification  Better Auth one-time sign-in and verification values.
//   account       the Google OAuth access, refresh and id tokens (and a password column).
// drizzle/0010_retire_better_auth.sql drops them (with user). d1-dump fails a run on an excluded
// name that is not a table, so runBackup passes it only the names that exist at run time
// (presentExcludes), and siteProblems fails any dump that carries one of them anyway. That
// holds whether the deploy or the migration lands first, and after both.
export const BACKUP_EXCLUDE = ["session", "verification", "account"] as const;

/** The credential tables to hand d1-dump as `exclude`: those in BACKUP_EXCLUDE that exist. */
export function presentExcludes(liveTables: Iterable<string>): string[] {
  const live = new Set(liveTables);
  return BACKUP_EXCLUDE.filter((name) => live.has(name));
}

// The irreplaceable content. Each must be dumped (required) and match the live count.
export const BACKUP_COUNTED_TABLES = ["posts", "content_blocks", "settings", "show_config"] as const;

/** germomics' own checks after the standard ones; one message per failure. */
export function siteProblems(dump: { tables: Array<{ name: string; rows: number }> }, liveCounts: Record<string, number>): string[] {
  const problems: string[] = [];
  const byName = new Map(dump.tables.map((t) => [t.name, t.rows]));

  for (const name of BACKUP_EXCLUDE) {
    if (byName.has(name)) problems.push(`${name} is in the dump but must be excluded`);
  }
  for (const name of BACKUP_COUNTED_TABLES) {
    const dumped = byName.get(name);
    const live = liveCounts[name];
    if (dumped === undefined) continue; // the standard required check names it
    if (live === undefined) problems.push(`no live count for ${name}`);
    else if (dumped !== live) problems.push(`${name} dumped ${dumped} rows but has ${live}`);
  }
  // An emptied database dumps cleanly and matches its own (empty) live counts, so counts alone
  // cannot catch it. The site always has settings and a show_config row.
  if (BACKUP_COUNTED_TABLES.every((n) => (byName.get(n) ?? 0) === 0)) {
    problems.push("every content table dumped empty");
  }
  return problems;
}
