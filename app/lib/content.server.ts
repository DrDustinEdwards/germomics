// Content-in-D1 read/write layer (server-only). settings + content_blocks live in D1 so all copy
// and config are searchable and AI-editable with no deploy, and a write shows on the next read.
// EVERY read falls back to the in-code default (app/lib/content-defaults.ts, generated from the same
// source as the seed), so a missing or draft row never breaks a page.
//
// Reads go straight to D1: the edge cache (workers/app.ts) already serves repeat visits, and on
// its misses a KV cache in front of D1 was cold too, adding a KV read and write to the round trips
// before the first byte. Settings and snippets are started once per request by the root middleware
// (getSettings/getSnippets in context.server).
import { accessAdmin } from "@dustinedwards/site-runtime/access";
import { escapeHtml } from "@dustinedwards/site-runtime/html";
import { eq, sql } from "drizzle-orm";
import { getDb } from "~/db/index.server";
import { settings as settingsTable, contentBlocks } from "~/db/schema";
import { SETTING_DEFAULTS, SNIPPET_DEFAULTS, PAGE_DEFAULTS } from "~/lib/content-defaults";
import { toFtsMatch } from "~/lib/posts.server";
import { getShowConfig } from "~/lib/show.server";
import { storedBody } from "~/lib/render.server";

/** True only for an admin viewing a page with ?preview (so drafts render in real context). */
export async function isPreviewing(env: Env, request: Request): Promise<boolean> {
  if (!new URL(request.url).searchParams.has("preview")) return false;
  return !!(await accessAdmin(request, env));
}

/**
 * A contact or legal page (drafts with ?preview for the admin), its {{email}} filled from show_config
 * and, when given, its {{address_line}}. The values are escaped: they come from settings, not from
 * the rendered body, and are injected as HTML (Grok audit 2026-10-21, GE-3).
 */
export async function loadFilledPage(
  env: Env,
  request: Request,
  key: string,
  fallbackTitle: string,
  addressLine?: Promise<string>,
): Promise<{ title: string; html: string }> {
  const preview = await isPreviewing(env, request);
  const [page, show, address] = await Promise.all([
    loadPage(env, key, { includeDrafts: preview }),
    getShowConfig(env),
    addressLine,
  ]);
  const html = fill(page.html, "email", show.ownerEmail);
  return {
    title: page.title || fallbackTitle,
    html: address === undefined ? html : fill(html, "address_line", address),
  };
}

/** A {{name}} placeholder filled with an escaped value, in text and in a link, where Prelum writes it percent-encoded. */
function fill(html: string, name: string, value: string): string {
  const safe = escapeHtml(value);
  return html.replaceAll(`{{${name}}}`, safe).replaceAll(`%7B%7B${name}%7D%7D`, safe);
}

/** Pages served as plain text (llms.txt, ai.txt): their bodies are not Markdown, so they are never rendered. */
export const TEXT_PAGES = new Set(["page:llms", "page:ai-txt"]);

type StrMap = Record<string, string>;

/** All settings as a key→value map. Fall back per key with setting(). */
export async function loadSettings(env: Env): Promise<StrMap> {
  const rows = await getDb(env)
    .select({ key: settingsTable.key, value: settingsTable.value })
    .from(settingsTable);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/** All snippet blocks as a key→value map. Snippets are instant (status ignored). */
export async function loadSnippets(env: Env): Promise<StrMap> {
  const rows = await getDb(env)
    .select({ key: contentBlocks.key, value: contentBlocks.value })
    .from(contentBlocks)
    .where(eq(contentBlocks.kind, "snippet"));
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export type PageBlock = { key: string; title: string; value: string; status: "draft" | "published" };
/** A page as a route shows it: its value (Markdown, or the text of a TEXT_PAGES page) and the HTML to show. */
export type Page = PageBlock & { html: string };

/**
 * A single content block. For public reads (includeDrafts=false) only a published row is returned;
 * a draft or missing row returns null so the caller can fall back. With includeDrafts=true (admin
 * preview) the row is returned as-is.
 */
export async function loadBlock(
  env: Env,
  key: string,
  opts: { includeDrafts?: boolean } = {},
): Promise<Page | null> {
  const rows = await getDb(env).select().from(contentBlocks).where(eq(contentBlocks.key, key)).limit(1);
  const row = rows[0];
  if (!row) return null;
  if (!opts.includeDrafts && row.status !== "published") return null;
  const block = { key: row.key, title: row.title ?? "", value: row.value, status: row.status };
  return TEXT_PAGES.has(key) || row.kind !== "page"
    ? { ...block, html: row.value }
    : { ...block, html: (await storedBody(env, { body: row.value, bodyHtml: row.bodyHtml, renderVersion: row.renderVersion })).html };
}

/**
 * A page with the in-code fallback applied, so it always renders something. The fallback is the seed's HTML
 * (content-defaults.ts), shown as it is.
 */
export async function loadPage(
  env: Env,
  key: string,
  opts: { includeDrafts?: boolean } = {},
): Promise<Page> {
  const found = await loadBlock(env, key, opts);
  if (found) return found;
  const d = PAGE_DEFAULTS[key];
  return { key, title: d?.title ?? "", value: d?.value ?? "", html: d?.value ?? "", status: "published" };
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

// ----- admin writers ---------------------------------------------------------
export async function upsertSetting(env: Env, key: string, value: string): Promise<void> {
  await getDb(env)
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({ target: settingsTable.key, set: { value, updatedAt: new Date().toISOString() } });
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
}

/** A Markdown page's title and status, which the admin sets; its text is written in Carrel (lib/carrel/adapter.server.ts). */
export async function updatePageSettings(env: Env, key: string, fields: { title: string | null; status: "draft" | "published" }): Promise<void> {
  await getDb(env)
    .update(contentBlocks)
    .set({ ...fields, updatedAt: new Date().toISOString() })
    .where(eq(contentBlocks.key, key));
}

/** List blocks for the admin editor. */
export async function listBlocks(env: Env): Promise<import("~/db/schema").ContentBlock[]> {
  return getDb(env).select().from(contentBlocks);
}
export async function listSettings(env: Env): Promise<import("~/db/schema").Setting[]> {
  return getDb(env).select().from(settingsTable);
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
