import { env } from "cloudflare:test";
import { eq, is } from "drizzle-orm";
import { SQLiteTable, getTableConfig } from "drizzle-orm/sqlite-core";
import { beforeAll, describe, expect, it, vi } from "vitest";
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

// The schema is loaded inside each test from a fresh module registry, so the definitions a test
// reads are the ones the file holds at that moment (and a mutation run sees a changed definition).
async function freshTables() {
  vi.resetModules();
  const fresh = await import("~/db/schema");
  return Object.values(fresh).filter((v) => is(v, SQLiteTable)) as unknown as SQLiteTable[];
}

// The default as SQLite stores it, rebuilt from what Drizzle declares.
function declaredDefault(col: { default?: unknown }): string | null {
  const d = col.default;
  if (d === undefined) return null;
  if (typeof d === "string") return `'${d}'`;
  if (typeof d === "number") return String(d);
  if (typeof d === "boolean") return d ? "1" : "0";
  const chunks = (d as { queryChunks?: { value?: string[] }[] }).queryChunks;
  // SQLite reports a parenthesised expression default, "(datetime('now'))", without the outer brackets.
  if (chunks) return chunks.map((c) => (c.value ?? []).join("")).join("").replace(/^\((.*)\)$/, "$1");
  return JSON.stringify(d);
}

type Pragma = { name: string; type: string; notnull: number; dflt_value: string | null; pk: number };
const pragma = async (table: string) => (await e.DB.prepare(`PRAGMA table_info("${table}")`).all<Pragma>()).results;

beforeAll(() => applyMigrations(e.DB), 60_000);

describe("app/db/schema.ts against the migrations", () => {
  it("reads every table the schema defines", async () => {
    const fresh = await freshTables();
    expect(fresh.length).toBeGreaterThanOrEqual(10);
    expect(new Set(fresh.map(nameOf)).size).toBe(fresh.length);
  });

  it.each(tables.map(nameOf))("%s has the same columns, nullability, primary key and defaults", async (name) => {
    const live = await pragma(name);
    const cfg = getTableConfig((await freshTables()).find((t) => nameOf(t) === name)!);
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
        // ... and the value is the same one, not only the fact of having one.
        expect(real.dflt_value, `${label} default value`).toBe(declaredDefault(col));
      }
    }
  });

  it("has the same indexes, both ways", async () => {
    const live = (await e.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'").all<{ name: string }>()).results.map((r) => r.name);
    const declared = (await freshTables()).flatMap((t) => getTableConfig(t).indexes.map((i) => i.config.name));
    expect(declared.length).toBeGreaterThan(0);
    expect(declared.filter((n) => !live.includes(n))).toEqual([]);
    expect(live.filter((n) => !declared.includes(n))).toEqual([]);
  });
});

describe("what the schema's column modes do", () => {
  it("gives a post inserted with only a title and slug every declared default, as typed values", async () => {
    const db = getDb(e);
    const [row] = await db.insert(schema.posts).values({ title: "T", slug: "defaults-check" }).returning();
    expect(row).toMatchObject({ kind: "article", status: "draft", body: "", featured: false, explicit: false, episodeType: "full", audioMimeType: "audio/mpeg", tags: [] });
    expect(row.createdAt).toMatch(/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/);
    await db.delete(schema.posts).where(eq(schema.posts.slug, "defaults-check"));
  });

  it("stores booleans as 0 and 1 and JSON columns as text, and reads them back typed", async () => {
    const db = getDb(e);
    await db.insert(schema.posts).values({ title: "T", slug: "modes-check", featured: true, explicit: true, tags: ["a", "b"], chapters: [{ start: 1, title: "C" }] });
    const raw = await e.DB.prepare("SELECT featured, explicit, tags, chapters FROM posts WHERE slug = 'modes-check'").first<Record<string, unknown>>();
    expect(raw).toEqual({ featured: 1, explicit: 1, tags: '["a","b"]', chapters: '[{"start":1,"title":"C"}]' });
    const [row] = await db.select().from(schema.posts).where(eq(schema.posts.slug, "modes-check"));
    expect(row).toMatchObject({ featured: true, explicit: true, tags: ["a", "b"], chapters: [{ start: 1, title: "C" }] });
    await db.delete(schema.posts).where(eq(schema.posts.slug, "modes-check"));
  });
});

describe("getDb", () => {
  it("opens the schema over the D1 binding, so a typed query reads a real table", async () => {
    const db = getDb(e);
    expect(await db.select().from(schema.posts).limit(1)).toEqual(expect.any(Array));
    expect(Object.keys(db._.fullSchema)).toContain("posts");
  });
});
