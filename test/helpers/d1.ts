// The schema is the real migrations, applied in order, so tests run against the real tables
// (posts with its FTS5 triggers, post_versions, content_blocks) rather than a copy that could drift.
const migrations = import.meta.glob("../../drizzle/*.sql", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

export async function applyMigrations(db: D1Database): Promise<void> {
  for (const name of Object.keys(migrations).sort()) {
    for (const stmt of splitSql(migrations[name])) await db.prepare(stmt).run();
  }
}

// Splits a migration into statements: strips comments, respects quotes, and keeps
// CREATE TRIGGER ... BEGIN ... END whole.
function splitSql(sql: string): string[] {
  const out: string[] = [];
  let buf = "";
  let quote = "";
  let depth = 0;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (quote) {
      buf += c;
      if (c === quote) quote = "";
      continue;
    }
    if (c === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      buf += "\n";
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      buf += c;
      continue;
    }
    if (c === ";" && depth === 0) {
      if (buf.trim()) out.push(buf.trim());
      buf = "";
      continue;
    }
    buf += c;
    const tail = buf.slice(-6).toUpperCase();
    if (/\bBEGIN$/.test(tail) && /^\W/.test(buf.slice(-6, -5) || " ")) depth++;
    if (depth > 0 && /;\s*END$/i.test(buf.slice(-12)) && !/[A-Za-z_]/.test(sql[i + 1] ?? " ")) depth--;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}
