// Content-in-D1 read/write layer (server-only). settings + content_blocks live in D1 so all copy
// and config are searchable and AI-editable with no deploy. Reads are KV-cached and busted on every
// admin write. EVERY read falls back to the in-code default (app/lib/content-defaults.ts, generated
// from the same source as the seed), so a missing or draft row never breaks a page.
//
// Injected per request via root middleware onto context (getSettings/getSnippets in context.server).
import { eq, sql } from "drizzle-orm";
import { getDb } from "~/db/index.server";
import { settings as settingsTable, contentBlocks } from "~/db/schema";
import { SETTING_DEFAULTS, SNIPPET_DEFAULTS, PAGE_DEFAULTS } from "~/lib/content-defaults";
import { getAdminSession } from "~/lib/auth.server";

/** True only for an admin viewing a page with ?preview (so drafts render in real context). */
export async function isPreviewing(env: Env, request: Request): Promise<boolean> {
  if (!new URL(request.url).searchParams.has("preview")) return false;
  return !!(await getAdminSession(env, request));
}

const TTL = 600; // seconds; also explicitly busted on write
const K_SETTINGS = "cache:content:settings";
const K_SNIPPETS = "cache:content:snippets";
const kBlock = (key: string) => `cache:content:block:${key}`;

type StrMap = Record<string, string>;

/** All settings as a key→value map (KV-cached). Fall back per key with setting(). */
export async function loadSettings(env: Env): Promise<StrMap> {
  const cached = await env.APP_KV.get(K_SETTINGS, "json");
  if (cached) return cached as StrMap;
  const rows = await getDb(env)
    .select({ key: settingsTable.key, value: settingsTable.value })
    .from(settingsTable);
  const map: StrMap = {};
  for (const r of rows) map[r.key] = r.value;
  await env.APP_KV.put(K_SETTINGS, JSON.stringify(map), { expirationTtl: TTL });
  return map;
}

/** All snippet blocks as a key→value map (KV-cached). Snippets are instant (status ignored). */
export async function loadSnippets(env: Env): Promise<StrMap> {
  const cached = await env.APP_KV.get(K_SNIPPETS, "json");
  if (cached) return cached as StrMap;
  const rows = await getDb(env)
    .select({ key: contentBlocks.key, value: contentBlocks.value })
    .from(contentBlocks)
    .where(eq(contentBlocks.kind, "snippet"));
  const map: StrMap = {};
  for (const r of rows) map[r.key] = r.value;
  await env.APP_KV.put(K_SNIPPETS, JSON.stringify(map), { expirationTtl: TTL });
  return map;
}

export type PageBlock = { key: string; title: string; value: string; status: "draft" | "published" };

/**
 * A single content block. For public reads (includeDrafts=false) only a published row is returned
 * and it is KV-cached; a draft or missing row returns null so the caller can fall back. With
 * includeDrafts=true (admin preview) the row is returned as-is and never cached.
 */
export async function loadBlock(
  env: Env,
  key: string,
  opts: { includeDrafts?: boolean } = {},
): Promise<PageBlock | null> {
  if (!opts.includeDrafts) {
    const cached = await env.APP_KV.get(kBlock(key), "json");
    if (cached) return cached as PageBlock;
  }
  const rows = await getDb(env).select().from(contentBlocks).where(eq(contentBlocks.key, key)).limit(1);
  const row = rows[0];
  if (!row) return null;
  const block: PageBlock = { key: row.key, title: row.title ?? "", value: row.value, status: row.status };
  if (opts.includeDrafts) return block;
  if (row.status !== "published") return null;
  await env.APP_KV.put(kBlock(key), JSON.stringify(block), { expirationTtl: TTL });
  return block;
}

/** A page with the in-code fallback applied, so it always renders something. */
export async function loadPage(
  env: Env,
  key: string,
  opts: { includeDrafts?: boolean } = {},
): Promise<PageBlock> {
  const found = await loadBlock(env, key, opts);
  if (found) return found;
  const d = PAGE_DEFAULTS[key];
  return { key, title: d?.title ?? "", value: d?.value ?? "", status: "published" };
}

/** Read a setting with fallback to the generated default then an optional caller default. */
export function setting(map: StrMap, key: string, fallback = ""): string {
  return map[key] ?? SETTING_DEFAULTS[key] ?? fallback;
}
export function settingNum(map: StrMap, key: string, fallback: number): number {
  const v = Number(setting(map, key, String(fallback)));
  return Number.isFinite(v) ? v : fallback;
}
/** Read a snippet with fallback to the generated default then an optional caller default. */
export function snippet(map: StrMap, key: string, fallback = ""): string {
  return map[key] ?? SNIPPET_DEFAULTS[key] ?? fallback;
}

/** Parse the contact.address JSON setting into a partial Address (for schema.org). */
export function settingAddress(map: StrMap): Partial<import("~/lib/site").Address> {
  try {
    return JSON.parse(setting(map, "contact.address", "{}")) as Partial<import("~/lib/site").Address>;
  } catch {
    return {};
  }
}

/** Bust the content caches after a write (settings, snippets, and an optional single block). */
export async function bustContentCache(env: Env, blockKey?: string): Promise<void> {
  await Promise.all([
    env.APP_KV.delete(K_SETTINGS),
    env.APP_KV.delete(K_SNIPPETS),
    blockKey ? env.APP_KV.delete(kBlock(blockKey)) : Promise.resolve(),
  ]);
}

// ----- admin writers ---------------------------------------------------------
export async function upsertSetting(env: Env, key: string, value: string): Promise<void> {
  await getDb(env)
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date().toISOString() } });
  await bustContentCache(env);
}

export type BlockInput = {
  key: string;
  kind: "page" | "snippet";
  title?: string | null;
  value: string;
  status?: "draft" | "published";
};

export async function upsertBlock(env: Env, b: BlockInput): Promise<void> {
  const set = {
    title: b.title ?? null,
    value: b.value,
    status: b.status ?? "draft",
    updatedAt: new Date().toISOString(),
  };
  await getDb(env)
    .insert(contentBlocks)
    .values({ key: b.key, kind: b.kind, ...set })
    .onConflictDoUpdate({ target: contentBlocks.key, set });
  await bustContentCache(env, b.key);
}

/** List blocks for the admin editor. */
export async function listBlocks(env: Env): Promise<import("~/db/schema").ContentBlock[]> {
  return getDb(env).select().from(contentBlocks);
}
export async function listSettings(env: Env): Promise<import("~/db/schema").Setting[]> {
  return getDb(env).select().from(settingsTable);
}

// FTS5 query from a raw search string: strip operators, AND the tokens, prefix-match the last one.
function toFtsMatch(raw: string): string | null {
  const tokens = raw.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  return tokens.map((t, i) => (i === tokens.length - 1 ? `${t}*` : t)).join(" ");
}

/** Full-text search across published pages (site search + raw SQL both reach every word). */
export async function searchPages(env: Env, rawQuery: string): Promise<PageBlock[]> {
  const match = toFtsMatch(rawQuery);
  if (!match) return [];
  const db = getDb(env);
  // FTS5 join by rowid (the one raw statement Drizzle's DSL can't express); published pages only.
  const rows = await db.all<{ key: string; title: string; value: string; status: string }>(
    sql`SELECT c.key AS key, c.title AS title, c.value AS value, c.status AS status
        FROM content_blocks_fts f JOIN content_blocks c ON c.rowid = f.rowid
        WHERE content_blocks_fts MATCH ${match} AND c.kind = 'page' AND c.status = 'published'
        ORDER BY rank LIMIT 10`,
  );
  return rows.map((r) => ({ key: r.key, title: r.title, value: r.value, status: r.status as "published" }));
}
