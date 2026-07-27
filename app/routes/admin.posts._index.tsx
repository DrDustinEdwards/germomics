import { useMemo, useState } from "react";
import { Form, Link, redirect, useFetcher } from "react-router";
import { Headphones, FileText, Plus, Copy, ExternalLink, Search, Pencil } from "lucide-react";
import type { Route } from "./+types/admin.posts._index";
import { getEnv } from "~/lib/context.server";
import { listAllPosts, createDraft, duplicatePost } from "~/lib/admin.server";
import { formatDate } from "~/lib/format";
import { Badge, inputCx, Button, EmptyState } from "~/components/admin/ui";
import { useSnippet } from "~/lib/content";
import type { Post } from "~/db/schema";

export async function loader({ context }: Route.LoaderArgs) {
  return { posts: await listAllPosts(getEnv(context)) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = getEnv(context);
  const form = await request.formData();
  const intent = String(form.get("intent") || "create");
  if (intent === "duplicate") {
    const id = await duplicatePost(env, Number(form.get("id")));
    throw redirect(`/admin/posts/${id}`);
  }
  const kind = form.get("kind") === "episode" ? "episode" : "article";
  const id = await createDraft(env, kind);
  throw redirect(`/admin/posts/${id}`);
}

type KindFilter = "all" | "episode" | "article";
type StatusFilter = "all" | "published" | "draft" | "scheduled";
type Sort = "updated" | "published" | "title";

function effectiveStatus(p: Post): StatusFilter {
  if (p.status === "published" && p.publishAt && p.publishAt > new Date().toISOString()) return "scheduled";
  return p.status === "published" ? "published" : "draft";
}

export default function AdminPosts({ loaderData }: Route.ComponentProps) {
  const dup = useFetcher();
  const emptyPosts = useSnippet("snippet:empty.posts", "No posts match these filters.");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<Sort>("updated");

  const rows = useMemo(() => {
    let list = loaderData.posts.slice();
    if (kind !== "all") list = list.filter((p) => p.kind === kind);
    if (status !== "all") list = list.filter((p) => effectiveStatus(p) === status);
    const needle = q.trim().toLowerCase();
    if (needle) list = list.filter((p) => p.title.toLowerCase().includes(needle) || p.slug.includes(needle));
    list.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "published") return String(b.publishedAt ?? "").localeCompare(String(a.publishedAt ?? ""));
      return String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? ""));
    });
    return list;
  }, [loaderData.posts, kind, status, q, sort]);

  const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 font-display text-xs transition ${
        active ? "border-brand bg-brand text-white" : "border-border text-muted hover:border-brand hover:text-ink"
      }`}
    >
      {children}
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Posts</h1>
        <div className="flex gap-2">
          <Form method="post">
            <input type="hidden" name="kind" value="episode" />
            <Button variant="primary"><Plus size={14} aria-hidden /> Episode</Button>
          </Form>
          <Form method="post">
            <input type="hidden" name="kind" value="article" />
            <Button variant="ghost"><Plus size={14} aria-hidden /> Article</Button>
          </Form>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title or slug…"
            aria-label="Search posts"
            className={`${inputCx} pl-9`}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Chip active={kind === "all"} onClick={() => setKind("all")}>All</Chip>
          <Chip active={kind === "episode"} onClick={() => setKind("episode")}>Episodes</Chip>
          <Chip active={kind === "article"} onClick={() => setKind("article")}>Articles</Chip>
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} aria-label="Filter by status" className={`${inputCx} w-auto`}>
          <option value="all">Any status</option>
          <option value="published">Published</option>
          <option value="scheduled">Scheduled</option>
          <option value="draft">Draft</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort by" className={`${inputCx} w-auto`}>
          <option value="updated">Recently updated</option>
          <option value="published">Recently published</option>
          <option value="title">Title A-Z</option>
        </select>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface text-left font-display text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Title</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Date</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((p) => {
              const st = effectiveStatus(p);
              return (
                <tr key={p.id} className="hover:bg-surface/60">
                  <td className="px-4 py-2.5">
                    <Link to={`/admin/posts/${p.id}`} className="flex min-w-0 items-center gap-2">
                      {p.kind === "episode" ? <Headphones size={14} className="shrink-0 text-brand" aria-hidden /> : <FileText size={14} className="shrink-0 text-brand" aria-hidden />}
                      <span className="truncate font-display font-medium text-ink">{p.title}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={st === "published" ? "accent" : st === "scheduled" ? "amber" : "muted"}>{st}</Badge>
                  </td>
                  <td className="hidden px-4 py-2.5 font-mono text-[11px] text-muted sm:table-cell">
                    {p.publishedAt ? formatDate(p.publishedAt) : "Not set"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Link to={`/admin/posts/${p.id}`} aria-label={`Edit ${p.title}`} className="grid h-8 w-8 place-items-center rounded text-muted hover:text-ink"><Pencil size={14} aria-hidden /></Link>
                      {st === "published" ? (
                        <Link to={`/${p.slug}`} aria-label={`View ${p.title}`} className="grid h-8 w-8 place-items-center rounded text-muted hover:text-ink"><ExternalLink size={14} aria-hidden /></Link>
                      ) : null}
                      <dup.Form method="post">
                        <input type="hidden" name="intent" value="duplicate" />
                        <input type="hidden" name="id" value={p.id} />
                        <button aria-label={`Duplicate ${p.title} as template`} title="Duplicate as template" className="grid h-8 w-8 place-items-center rounded text-muted hover:text-ink"><Copy size={14} aria-hidden /></button>
                      </dup.Form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 ? <EmptyState>{emptyPosts}</EmptyState> : null}
      </div>
    </div>
  );
}
