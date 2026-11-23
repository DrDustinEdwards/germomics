// A Markdown page of the site (a content_blocks row of kind "page") as Carrel sees it: its id, summary, version and
// history. The adapter (./adapter.server.ts) writes them.
import { and, eq } from "drizzle-orm";
import { parseSqlTime } from "@dustinedwards/site-runtime/time";
import { contentVersion, type ContentSummary } from "@dustinedwards/site-api";
import { getDb } from "~/db/index.server";
import { contentBlocks, contentBlockVersions, type ContentBlock } from "~/db/schema";
import { TEXT_PAGES } from "~/lib/content.server";
import { PAGE_HREF } from "~/lib/site";
import { renderPageSource } from "./source";

// A page's id: content_blocks' `page:about` is Carrel's `page.about` (a colon is not an id character).
export const PAGE_ID = /^page\.([a-z0-9-]+)$/;
export const pageKeyOf = (id: string) => (PAGE_ID.test(id) ? `page:${PAGE_ID.exec(id)![1]}` : null);
const pageIdOf = (key: string) => key.replace(/^page:/, "page.");

// SQLite's datetime('now') is "YYYY-MM-DD HH:MM:SS" in UTC; the contract wants ISO with an offset.
export const iso = (v: string | null | undefined): string | null => {
  const at = parseSqlTime(v);
  return at === null ? null : new Date(at).toISOString();
};

export type PageRow = ContentBlock;
export const pageVersion = (b: PageRow) => contentVersion([renderPageSource(b), b.status]);

export async function pageSummary(b: PageRow): Promise<ContentSummary> {
  return {
    id: pageIdOf(b.key),
    kind: "page",
    title: b.title || b.key,
    status: b.status === "published" ? "published" : "draft",
    path: b.status === "published" ? (PAGE_HREF[b.key] ?? null) : null,
    publishAt: null,
    publishedAt: null,
    updatedAt: iso(b.updatedAt),
    version: await pageVersion(b),
    trashedAt: null,
  };
}

export async function findPage(env: Env, id: string): Promise<PageRow | null> {
  const key = pageKeyOf(id);
  if (!key || TEXT_PAGES.has(key)) return null;
  const rows = await getDb(env)
    .select()
    .from(contentBlocks)
    .where(and(eq(contentBlocks.key, key), eq(contentBlocks.kind, "page")))
    .limit(1);
  return rows[0] ?? null;
}

export const pageHistory = (env: Env, key: string) =>
  getDb(env)
    .select()
    .from(contentBlockVersions)
    .where(eq(contentBlockVersions.blockKey, key))
    .orderBy(contentBlockVersions.id);

export async function listPages(env: Env): Promise<PageRow[]> {
  const rows = await getDb(env).select().from(contentBlocks).where(eq(contentBlocks.kind, "page"));
  return rows.filter((b) => !TEXT_PAGES.has(b.key));
}
