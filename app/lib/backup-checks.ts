// The checks a nightly dump must pass before it is marked complete. Pure (no d1-dump, no
// bindings) so the tests can plant a bad dump and watch each check go red.
//
// EXCLUDED on purpose, because they hold live credentials or one-time tokens. A backup copy is
// one more place a session could leak from, and restoring one revives old sessions:
//   session       Better Auth sessions: a bearer `token` per row, plus IP and user agent.
//   verification  Better Auth one-time sign-in and verification values.
// KEPT: user and account (account rows are how a restored database recognises the admin). Note
// account also carries Google access/refresh/id tokens; see the PR for that decision.
// When job_7e3fefd2f0db drops the Better Auth tables, remove them from this list in the same
// change, because d1-dump fails the run on an excluded name that is not a table.
export const BACKUP_EXCLUDE = ["session", "verification"] as const;

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
    if (!dump.excluded.includes(name)) problems.push(`${name} is not recorded as excluded`);
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
