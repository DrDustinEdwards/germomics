// Content-in-D1 layer: settings and content_blocks, so copy changes with no deploy. Every read falls back to the
// in-code default (content-defaults.ts, generated from the seed), so a missing or draft row never breaks a page.
// Reads go straight to D1, with no KV in front: the edge cache (workers/app.ts) serves repeats.
import { accessAdmin } from "@dustinedwards/site-runtime/access";
import { escapeHtml } from "@dustinedwards/site-runtime/html";
import { eq, sql } from "drizzle-orm";
import type { RouterContextProvider } from "react-router";
import { getEnv } from "@dustinedwards/site-runtime/context";
import { getDb } from "~/db/index.server";
import { settings as settingsTable, contentBlocks } from "~/db/schema";
import { SETTING_DEFAULTS, PAGE_DEFAULTS } from "~/lib/content-defaults";
import { draftPageContext } from "~/lib/preview-context";
import { toFtsMatch } from "~/lib/posts.server";
import { getShowConfig } from "~/lib/show.server";
import { storedBody } from "~/lib/render.server";
import { SITE_ADDRESS_LINE } from "~/lib/site";

export async function isPreviewing(env: Env, request: Request): Promise<boolean> {
  if (!new URL(request.url).searchParams.has("preview")) return false;
  return !!(await accessAdmin(request, env));
}

/** A page as its route shows it: Carrel's preview draft in a preview render, else the block (drafts with ?preview). */
export async function routePage(
  context: Readonly<RouterContextProvider>,
  request: Request,
  key: string,
): Promise<Page> {
  const env = getEnv(context);
  const draft = context.get(draftPageContext);
  if (draft?.key === key) {
    const shown = await loadPage(env, key, { includeDrafts: true });
    return {
      ...shown,
      title: draft.title ?? shown.title,
      value: "",
      html: draft.html,
      status: "draft",
    };
  }
  return loadPage(env, key, { includeDrafts: await isPreviewing(env, request) });
}

/** A contact or legal page with {{email}} and {{address_line}} filled in. The values come from settings, not the body, so they are escaped. */
export async function loadFilledPage(
  context: Readonly<RouterContextProvider>,
  request: Request,
  key: string,
  fallbackTitle: string,
  settings: Promise<StrMap>,
): Promise<{ title: string; html: string; updatedAt?: string }> {
  const [page, show, s] = await Promise.all([
    routePage(context, request, key),
    getShowConfig(getEnv(context)),
    settings,
  ]);
  return {
    title: page.title || fallbackTitle,
    updatedAt: page.updatedAt,
    html: fill(
      fill(page.html, "email", show.ownerEmail),
      "address_line",
      setting(s, "contact.address_line", SITE_ADDRESS_LINE),
    ),
  };
}

/** A {{name}} placeholder filled with an escaped value, in text and in a link, where Prelum writes it percent-encoded. */
function fill(html: string, name: string, value: string): string {
  const safe = escapeHtml(value);
  return html.replaceAll(`{{${name}}}`, safe).replaceAll(`%7B%7B${name}%7D%7D`, safe);
}

/** Plain-text pages (llms.txt, ai.txt): never rendered. */
export const TEXT_PAGES = new Set(["page:llms", "page:ai-txt"]);

type StrMap = Record<string, string>;

export async function loadSettings(env: Env): Promise<StrMap> {
  const rows = await getDb(env)
    .select({ key: settingsTable.key, value: settingsTable.value })
    .from(settingsTable);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export type PageBlock = {
  key: string;
  title: string;
  value: string;
  status: "draft" | "published";
};
/** A page as a route shows it: its value (Markdown, or the text of a TEXT_PAGES page) and the HTML to show. */
export type Page = PageBlock & { html: string; updatedAt?: string };

/** A public read (includeDrafts=false) returns only a published row; a draft or missing one is null. */
export async function loadBlock(
  env: Env,
  key: string,
  opts: { includeDrafts?: boolean } = {},
): Promise<Page | null> {
  const rows = await getDb(env)
    .select()
    .from(contentBlocks)
    .where(eq(contentBlocks.key, key))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (!opts.includeDrafts && row.status !== "published") return null;
  const block = {
    key: row.key,
    title: row.title ?? "",
    value: row.value,
    status: row.status,
    updatedAt: row.updatedAt,
  };
  return TEXT_PAGES.has(key) || row.kind !== "page"
    ? { ...block, html: row.value }
    : {
        ...block,
        html: (
          await storedBody(env, {
            body: row.value,
            bodyHtml: row.bodyHtml,
            renderVersion: row.renderVersion,
          })
        ).html,
      };
}

export async function loadPage(
  env: Env,
  key: string,
  opts: { includeDrafts?: boolean } = {},
): Promise<Page> {
  const found = await loadBlock(env, key, opts);
  if (found) return found;
  const d = PAGE_DEFAULTS[key];
  return {
    key,
    title: d?.title ?? "",
    value: d?.value ?? "",
    html: d?.value ?? "",
    status: "published",
  };
}

export function setting(map: StrMap, key: string, fallback = ""): string {
  return map[key] ?? SETTING_DEFAULTS[key] ?? fallback;
}
export function settingNum(map: StrMap, key: string, fallback: number): number {
  const v = Number(setting(map, key, String(fallback)));
  return Number.isFinite(v) ? v : fallback;
}

export function settingAddress(map: StrMap): Partial<import("~/lib/site").Address> {
  try {
    return JSON.parse(setting(map, "contact.address", "{}")) as Partial<
      import("~/lib/site").Address
    >;
  } catch {
    return {};
  }
}

export async function upsertSetting(env: Env, key: string, value: string): Promise<void> {
  await getDb(env)
    .insert(settingsTable)
    .values({ key, value })
    .onConflictDoUpdate({
      target: settingsTable.key,
      set: { value, updatedAt: new Date().toISOString() },
    });
}

export type BlockInput = {
  key: string;
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
    .values({ key: b.key, kind: "page", ...set })
    .onConflictDoUpdate({ target: contentBlocks.key, set });
}

export async function listBlocks(env: Env): Promise<import("~/db/schema").ContentBlock[]> {
  return getDb(env).select().from(contentBlocks);
}
export async function listSettings(env: Env): Promise<import("~/db/schema").Setting[]> {
  return getDb(env).select().from(settingsTable);
}

export async function searchPages(env: Env, rawQuery: string): Promise<PageBlock[]> {
  const match = toFtsMatch(rawQuery);
  if (!match) return [];
  const db = getDb(env);
  const rows = await db.all<{ key: string; title: string; value: string; status: string }>(
    sql`SELECT c.key AS key, c.title AS title, c.value AS value, c.status AS status
        FROM content_blocks_fts f JOIN content_blocks c ON c.rowid = f.rowid
        WHERE content_blocks_fts MATCH ${match} AND c.kind = 'page' AND c.status = 'published'
        ORDER BY rank LIMIT 10`,
  );
  return rows.map((r) => ({
    key: r.key,
    title: r.title,
    value: r.value,
    status: r.status as "published",
  }));
}
