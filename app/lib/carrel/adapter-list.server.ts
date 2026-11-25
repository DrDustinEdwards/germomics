import { getTableColumns } from "drizzle-orm";
import { inList } from "@dustinedwards/site-runtime/d1";
import { orderAndPage, type ContentAdapter } from "@dustinedwards/site-api";
import { posts } from "~/db/schema";
import { ID_PATTERN, creditOf, statusOf, summaryOf } from "./adapter-support.server";
import { iso, listPages, pageSummary } from "./pages.server";
import type { Writes } from "./adapter-writes.server";

/** The posts and pages Carrel's list asks for: filtered on light rows, then only the page shown is read in full. */
export async function listContent(
  {
    db,
    env,
    showAuthor,
    withPeople,
    waiting,
  }: Pick<Writes, "db" | "env" | "showAuthor" | "withPeople" | "waiting">,
  query: Parameters<ContentAdapter["list"]>[0],
) {
  const { status, q, kind, tag, author, publishedAfter, publishedBefore, trashed = false } = query;
  const show = await showAuthor();
  const needle = q?.toLowerCase();
  const after = publishedAfter ? new Date(publishedAfter).toISOString() : null;
  const before = publishedBefore ? new Date(publishedBefore).toISOString() : null;
  // The filter needs no transcript, rendered body or waveform; the page shown is read in full below.
  const {
    transcript: _t,
    bodyHtml: _h,
    audioPeaks: _p,
    bodyMeta: _m,
    ...light
  } = getTableColumns(posts);
  const rows = (await db.select(light).from(posts)).filter((p) => {
    const published = iso(p.publishedAt);
    return (
      ID_PATTERN.test(p.slug) &&
      !!p.trashedAt === trashed &&
      (!kind || p.kind === kind) &&
      (!tag || (p.tags ?? []).includes(tag)) &&
      (!author || creditOf(p, show).includes(author)) &&
      (!after || (published !== null && published >= after)) &&
      (!before || (published !== null && published <= before)) &&
      (!needle || [p.title, p.slug, p.body].some((t) => t.toLowerCase().includes(needle))) &&
      (!status || statusOf(p) === status)
    );
  });
  const pages =
    trashed || tag || author || after || before || (kind && kind !== "page")
      ? []
      : (await listPages(env)).filter(
          (b) =>
            (!status || (b.status === "published" ? "published" : "draft") === status) &&
            (!needle ||
              [b.title ?? "", b.key, b.value].some((t) => t.toLowerCase().includes(needle))),
        );
  const all = [
    ...rows.map((p) => ({
      post: p,
      page: null,
      updated: iso(p.updatedAt),
      published: iso(p.publishedAt),
      title: p.title,
    })),
    ...pages.map((b) => ({
      post: null,
      page: b,
      updated: iso(b.updatedAt),
      published: null,
      title: b.title || b.key,
    })),
  ];
  const { page: shown, ...rest } = orderAndPage(all, query, {
    updated: (i) => i.updated ?? "",
    published: (i) => i.published ?? "",
    title: (i) => i.title.toLowerCase(),
  });
  // Only the page shown is read in full: its episodes' people and its waiting updates.
  const ids = shown.flatMap((i) => (i.post ? [i.post.id] : []));
  const fullRows = ids.length ? await db.select().from(posts).where(inList(posts.id, ids)) : [];
  const full = new Map((await withPeople(fullRows)).map((p) => [p.id, p]));
  const items = await Promise.all(
    shown.map(async (i) =>
      i.post
        ? summaryOf(full.get(i.post.id)!, show, await waiting(i.post.slug))
        : pageSummary(i.page!),
    ),
  );
  return { items, ...rest };
}
