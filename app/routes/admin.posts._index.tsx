import { Form, Link, redirect } from "react-router";
import { Headphones, FileText, Plus } from "lucide-react";
import type { Route } from "./+types/admin.posts._index";
import { getEnv } from "~/lib/context.server";
import { listAllPosts, createDraft } from "~/lib/admin.server";
import { formatDate } from "~/lib/format";

export async function loader({ context }: Route.LoaderArgs) {
  return { posts: await listAllPosts(getEnv(context)) };
}

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const kind = form.get("kind") === "episode" ? "episode" : "article";
  const id = await createDraft(getEnv(context), kind);
  throw redirect(`/admin/posts/${id}`);
}

export default function AdminPosts({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Posts</h1>
        <div className="flex gap-2">
          <Form method="post">
            <input type="hidden" name="kind" value="episode" />
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 font-display text-sm text-white hover:bg-brand-strong">
              <Plus size={14} aria-hidden /> Episode
            </button>
          </Form>
          <Form method="post">
            <input type="hidden" name="kind" value="article" />
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 font-display text-sm hover:border-brand">
              <Plus size={14} aria-hidden /> Article
            </button>
          </Form>
        </div>
      </div>

      <ul className="mt-6 divide-y divide-border rounded-xl border border-border bg-card">
        {loaderData.posts.map((p) => (
          <li key={p.id}>
            <Link to={`/admin/posts/${p.id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-surface">
              <span className="flex min-w-0 items-center gap-2">
                {p.kind === "episode" ? (
                  <Headphones size={14} className="text-brand" aria-hidden />
                ) : (
                  <FileText size={14} className="text-brand" aria-hidden />
                )}
                <span className="truncate font-display">{p.title}</span>
              </span>
              <span className="ml-3 flex shrink-0 items-center gap-2 font-mono text-[11px] uppercase text-muted">
                <span className={p.status === "published" ? "text-accent" : "text-brand"}>{p.status}</span>
                {p.publishedAt ? <span>{formatDate(p.publishedAt)}</span> : null}
              </span>
            </Link>
          </li>
        ))}
        {loaderData.posts.length === 0 ? (
          <li className="px-4 py-3 text-muted">No posts yet — create one above.</li>
        ) : null}
      </ul>
    </div>
  );
}
