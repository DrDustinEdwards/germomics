// The checks a nightly dump must pass before it is marked complete. Pure (no d1-dump, no
// bindings) so the tests can plant a bad dump and watch each check go red.
//
// NEVER IN A DUMP, because they held live credentials or one-time tokens. A backup copy is one
// more place a credential could leak from, and restoring a session revives old sign-ins:
//   session       Better Auth sessions: a bearer `token` per row, plus IP and user agent.
//   verification  Better Auth one-time sign-in and verification values.
//   account       the Google OAuth access, refresh and id tokens (and a password column).
// drizzle/0010_retire_better_auth.sql drops them (with user). d1-dump fails a run on an excluded
// name that is not a table, so runBackup passes it only the names that exist at run time
// (presentExcludes), and the guard below fails any dump that carries one of them anyway. That
// holds whether the deploy or the migration lands first, and after both.
export const BACKUP_EXCLUDE = ["session", "verification", "account"] as const;

/** The credential tables to hand d1-dump as `exclude`: those in BACKUP_EXCLUDE that exist. */
export function presentExcludes(liveTables: Iterable<string>): string[] {
  const live = new Set(liveTables);
  return BACKUP_EXCLUDE.filter((name) => live.has(name));
}

// The irreplaceable content. Each must be dumped, non-empty, and match the live count.
export const BACKUP_COUNTED_TABLES = ["posts", "content_blocks", "settings", "show_config"] as const;

export type DumpSummary = {
  tables: Array<{ name: string; rows: number }>;
  excluded: string[];
};

/** Returns one message per failed check; empty means the dump may be marked complete. */
export function dumpProblems(dump: DumpSummary, liveCounts: Record<string, number>): string[] {
  const problems: string[] = [];
  if (dump.tables.length === 0) problems.push("the dump holds no tables");
  const byName = new Map(dump.tables.map((t) => [t.name, t.rows]));

  for (const name of BACKUP_EXCLUDE) {
    if (byName.has(name)) problems.push(`${name} is in the dump but must be excluded`);
  }

  for (const name of BACKUP_COUNTED_TABLES) {
    const dumped = byName.get(name);
    if (dumped === undefined) {
      problems.push(`${name} is missing from the dump`);
      continue;
    }
    const live = liveCounts[name];
    if (live === undefined) problems.push(`no live count for ${name}`);
    else if (dumped === 0 && live > 0) problems.push(`${name} dumped empty but has ${live} rows`);
    else if (dumped !== live) problems.push(`${name} dumped ${dumped} rows but has ${live}`);
  }
  // An emptied database dumps cleanly and matches its own (empty) live counts, so counts alone
  // cannot catch it. The site always has settings and a show_config row.
  if (BACKUP_COUNTED_TABLES.every((n) => (byName.get(n) ?? 0) === 0)) {
    problems.push("every content table dumped empty");
  }
  return problems;
}
