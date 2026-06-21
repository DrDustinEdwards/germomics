import { Link } from "react-router";
import { FilePlus2, Headphones, FileText, PencilLine } from "lucide-react";
import type { Route } from "./+types/admin._index";
import { getEnv } from "~/lib/context.server";
import { listAllPosts } from "~/lib/admin.server";
import { formatDate } from "~/lib/format";

export async function loader({ context }: Route.LoaderArgs) {
  const all = await listAllPosts(getEnv(context));
  return {
    counts: {
      episodes: all.filter((p) => p.kind === "episode").length,
      articles: all.filter((p) => p.kind === "article").length,
      drafts: all.filter((p) => p.status === "draft").length,
    },
    recent: all.slice(0, 8),
  };
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const { counts, recent } = loaderData;
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Dashboard</h1>
        <Link
          to="/admin/posts"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 font-display text-sm text-white hover:bg-brand-strong"
        >
          <FilePlus2 size={15} aria-hidden /> Manage posts
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        {[
          ["Episodes", counts.episodes, <Headphones key="e" size={16} aria-hidden />],
          ["Articles", counts.articles, <FileText key="a" size={16} aria-hidden />],
          ["Drafts", counts.drafts, <PencilLine key="d" size={16} aria-hidden />],
        ].map(([label, n, icon]) => (
          <div key={label as string} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-muted">
              {icon} {label}
            </div>
            <div className="mt-1 font-display text-2xl font-semibold">{n as number}</div>
          </div>
        ))}
      </div>

      <h2 className="mb-2 mt-8 font-display text-lg font-semibold">Recent</h2>
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {recent.map((p) => (
          <li key={p.id}>
            <Link to={`/admin/posts/${p.id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-surface">
              <span className="truncate font-display">{p.title}</span>
              <span className="ml-3 flex shrink-0 items-center gap-2 font-mono text-[11px] uppercase text-muted">
                <span>{p.kind}</span>
                <span className={p.status === "published" ? "text-accent" : "text-brand"}>{p.status}</span>
                {p.publishedAt ? <span>{formatDate(p.publishedAt)}</span> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
