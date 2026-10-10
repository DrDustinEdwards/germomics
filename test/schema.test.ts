import { env } from "cloudflare:test";
import { is } from "drizzle-orm";
import { SQLiteTable, getTableConfig } from "drizzle-orm/sqlite-core";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "~/db/schema";
import { getDb } from "~/db/index.server";
import { applyMigrations } from "./helpers/d1";

// CLAUDE.md hard rule 2: migrations are hand-written SQL kept in step with app/db/schema.ts. A
// column in one and not the other is a query that fails in production only. The test derives both
// sides, the real migrated tables and the Drizzle definitions, and fails both ways: a column the
// schema names that the database lacks, and a column the database has that the schema does not
// know (rule 3.4). The FTS5 mirror tables are raw SQL on purpose and are not in the schema.
const e = env as unknown as Env;
const tables = Object.values(schema).filter((v) => is(v, SQLiteTable)) as unknown as SQLiteTable[];
const nameOf = (t: SQLiteTable) => getTableConfig(t).name;

type Pragma = { name: string; type: string; notnull: number; dflt_value: string | null; pk: number };
const pragma = async (table: string) => (await e.DB.prepare(`PRAGMA table_info("${table}")`).all<Pragma>()).results;

beforeAll(() => applyMigrations(e.DB), 60_000);

describe("app/db/schema.ts against the migrations", () => {
  it("reads every table the schema defines", () => {
    expect(tables.length).toBeGreaterThanOrEqual(10);
    expect(new Set(tables.map(nameOf)).size).toBe(tables.length);
  });

  it.each(tables.map((t) => [nameOf(t), t] as const))("%s has the same columns, nullability, primary key and defaults", async (name, table) => {
    const live = await pragma(name);
    const cfg = getTableConfig(table);
    expect(live.length, `${name} exists in the migrated database`).toBeGreaterThan(0);
    expect(cfg.columns.map((c) => c.name).sort()).toEqual(live.map((c) => c.name).sort());
    for (const col of cfg.columns) {
      const real = live.find((c) => c.name === col.name)!;
      const label = `${name}.${col.name}`;
      expect(real.type.toLowerCase(), `${label} type`).toBe(col.getSQLType().toLowerCase());
      expect(real.pk === 1, `${label} primary key`).toBe(col.primary);
      // A primary key column is NOT NULL to Drizzle, but SQLite reports notnull 0 for INTEGER PRIMARY KEY.
      // The same goes for the key's default: Drizzle counts AUTOINCREMENT as one, SQLite stores none.
      if (!col.primary) {
        expect(real.notnull === 1, `${label} not null`).toBe(col.notNull);
        expect(real.dflt_value !== null, `${label} has a default`).toBe(col.hasDefault);
      }
    }
  });

  it("has the same indexes, both ways", async () => {
    const live = (await e.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'").all<{ name: string }>()).results.map((r) => r.name);
    const declared = tables.flatMap((t) => getTableConfig(t).indexes.map((i) => i.config.name));
    expect(declared.length).toBeGreaterThan(0);
    expect(declared.filter((n) => !live.includes(n))).toEqual([]);
    expect(live.filter((n) => !declared.includes(n))).toEqual([]);
  });
});

describe("getDb", () => {
  it("opens the schema over the D1 binding, so a typed query reads a real table", async () => {
    const db = getDb(e);
    expect(await db.select().from(schema.posts).limit(1)).toEqual(expect.any(Array));
    expect(Object.keys(db._.fullSchema)).toContain("posts");
  });
});
