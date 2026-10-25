import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { backupHealth } from "@dustinedwards/d1-dump";
import { runBackup } from "~/lib/backup.server";

// One integration test per real behavior, against real D1 and R2 in Miniflare. The schema is a
// reduced copy of the production shape: the tables the checks name and an external-content FTS5
// table (the reason `wrangler d1 export` fails here). CREDENTIAL_SCHEMA adds the Better Auth
// tables as they stand before drizzle/0010_retire_better_auth.sql; the backup must pass both
// with and without them, because the deploy and the migration land at different moments.
const SCHEMA = [
  "CREATE TABLE posts (id INTEGER PRIMARY KEY, title TEXT, body TEXT, excerpt TEXT)",
  "CREATE VIRTUAL TABLE posts_fts USING fts5(title, body, excerpt, content='posts', content_rowid='id')",
  "CREATE TABLE content_blocks (key TEXT PRIMARY KEY, body TEXT)",
  "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)",
  "CREATE TABLE show_config (id INTEGER PRIMARY KEY, title TEXT)",
];
const CREDENTIAL_SCHEMA = [
  "CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT)",
  "CREATE TABLE session (id TEXT PRIMARY KEY, token TEXT, user_id TEXT)",
  "CREATE TABLE account (id TEXT PRIMARY KEY, refresh_token TEXT, user_id TEXT)",
  "CREATE TABLE verification (id TEXT PRIMARY KEY, value TEXT)",
];

async function reset(withCredentials = true) {
  const names = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type IN ('table') AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all<{ name: string }>();
  await env.DB.exec("PRAGMA foreign_keys = OFF");
  for (const { name } of names.results) await env.DB.exec(`DROP TABLE IF EXISTS "${name}"`);
  for (const sql of withCredentials ? [...SCHEMA, ...CREDENTIAL_SCHEMA] : SCHEMA) await env.DB.exec(sql);
  const listed = await env.BACKUPS.list();
  if (listed.objects.length) await env.BACKUPS.delete(listed.objects.map((o) => o.key));
}

async function seed(withCredentials = true) {
  await env.DB.batch([
    env.DB.prepare("INSERT INTO posts (id, title, body, excerpt) VALUES (1, 'Cholera', 'Broad Street pump', 'x')"),
    env.DB.prepare("INSERT INTO posts_fts (rowid, title, body, excerpt) VALUES (1, 'Cholera', 'Broad Street pump', 'x')"),
    env.DB.prepare("INSERT INTO content_blocks VALUES ('page:about', 'About')"),
    env.DB.prepare("INSERT INTO settings VALUES ('site.name', 'Germomics')"),
    env.DB.prepare("INSERT INTO show_config VALUES (1, 'Germomics')"),
  ]);
  if (!withCredentials) return;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO user VALUES ('u1', 'admin@example.com')"),
    env.DB.prepare("INSERT INTO session VALUES ('s1', 'SECRET-SESSION-TOKEN', 'u1')"),
    env.DB.prepare("INSERT INTO account VALUES ('a1', 'SECRET-OAUTH-REFRESH-TOKEN', 'u1')"),
    env.DB.prepare("INSERT INTO verification VALUES ('v1', 'SECRET-ONE-TIME-VALUE')"),
  ]);
}

describe("nightly backup", () => {
  beforeEach(() => reset());

  it("dumps the content, leaves out session, verification and account, and reports a fresh age", async () => {
    await seed();
    await runBackup(env as unknown as Env);

    const keys = (await env.BACKUPS.list()).objects.map((o) => o.key);
    expect(keys.some((k) => k.endsWith("/_complete.json"))).toBe(true);
    for (const t of ["posts", "content_blocks", "settings", "show_config", "user"]) {
      expect(keys.some((k) => k.endsWith(`/${t}.json`))).toBe(true);
    }
    expect(keys.some((k) => k.endsWith("/session.json"))).toBe(false);
    expect(keys.some((k) => k.endsWith("/verification.json"))).toBe(false);
    expect(keys.some((k) => k.endsWith("/account.json"))).toBe(false);

    for (const k of keys) {
      const text = await (await env.BACKUPS.get(k))!.text();
      expect(text).not.toContain("SECRET-SESSION-TOKEN");
      expect(text).not.toContain("SECRET-ONE-TIME-VALUE");
      expect(text).not.toContain("SECRET-OAUTH-REFRESH-TOKEN");
    }

    const health = await backupHealth(env.BACKUPS);
    expect(health.warning).toBeUndefined();
    expect(health.age_hours).toBeLessThan(1);
  });

  it("passes a database without the Better Auth tables (after 0010) and marks the dump complete", async () => {
    await reset(false);
    await seed(false);
    await runBackup(env as unknown as Env);

    const keys = (await env.BACKUPS.list()).objects.map((o) => o.key);
    expect(keys.some((k) => k.endsWith("/_complete.json"))).toBe(true);
    for (const t of ["posts", "content_blocks", "settings", "show_config"]) {
      expect(keys.some((k) => k.endsWith(`/${t}.json`))).toBe(true);
    }
    const health = await backupHealth(env.BACKUPS);
    expect(health.warning).toBeUndefined();
  });

  it("leaves an emptied database without a marker, and throws", async () => {
    await expect(runBackup(env as unknown as Env)).rejects.toThrow(/left incomplete: .*every counted table dumped empty/);
    const keys = (await env.BACKUPS.list()).objects.map((o) => o.key);
    expect(keys.some((k) => k.endsWith("/_complete.json"))).toBe(false);
    const health = await backupHealth(env.BACKUPS);
    expect(health.last_ok).toBeNull();
    expect(health.warning).toMatch(/no complete dump/);
  });

  it("warns when the newest complete dump is older than 26 hours", async () => {
    await seed();
    await runBackup(env as unknown as Env);
    const later = new Date(Date.now() + 27 * 3_600_000);
    const health = await backupHealth(env.BACKUPS, { now: later });
    expect(health.warning).toMatch(/over the 26h threshold/);
  });
});
