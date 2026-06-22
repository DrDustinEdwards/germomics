import { Form, Link } from "react-router";
import { Search } from "lucide-react";
import type { Route } from "./+types/archive";
import { getEnv } from "~/lib/context.server";
import { listPosts, searchPosts, toPlayerTrack } from "~/lib/posts.server";
import { searchPages } from "~/lib/content.server";
import { PostCard } from "~/components/content/PostCard";
import { QueueSeeder } from "~/components/content/QueueSeeder";

// Maps a content page key to its public URL (for site-search page hits).
const PAGE_HREF: Record<string, string> = {
  "page:about": "/about",
  "page:dustin-edwards": "/about/dustin-edwards",
  "page:privacy": "/privacy",
  "page:terms": "/terms",
  "page:llms": "/llms.txt",
  "page:ai-txt": "/ai.txt",
};

const TABS = [
  ["all", "All"],
  ["episodes", "Episodes"],
  ["writing", "Writing"],
] as const;

export function meta() {
  return [{ title: "Archive · germomics" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const url = new URL(request.url);
  const tab = (url.searchParams.get("tab") ?? "all") as "all" | "episodes" | "writing";
  const q = url.searchParams.get("q")?.trim() ?? "";

  let items;
  if (q) {
    items = await searchPosts(env, q);
    if (tab === "episodes") items = items.filter((p) => p.kind === "episode");
    if (tab === "writing") items = items.filter((p) => p.kind === "article");
  } else {
    items = await listPosts(env, {
      kind: tab === "episodes" ? "episode" : tab === "writing" ? "article" : undefined,
    });
  }

  // Site search also reaches the content pages (about/privacy/terms/...) via content_blocks FTS.
  const pages = q && tab === "all" ? await searchPages(env, q) : [];

  const tracks = items.filter((p) => p.kind === "episode").map(toPlayerTrack);
  return { items, tracks, tab, q, pages };
}

export default function Archive({ loaderData }: Route.ComponentProps) {
  const { items, tracks, tab, q, pages } = loaderData;
  return (
    <div>
      <QueueSeeder tracks={tracks} />
      <h1 className="mb-4 font-display text-3xl font-semibold">Archive</h1>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {TABS.map(([key, label]) => (
            <Link
              key={key}
              to={`/archive?tab=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded-full px-3 py-1.5 font-display text-sm ${
                tab === key ? "bg-brand text-white" : "border border-border text-muted hover:text-ink"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <Form method="get" className="flex items-center gap-2">
          <input type="hidden" name="tab" value={tab} />
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
            <Search size={15} aria-hidden className="text-muted" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search…"
              aria-label="Search content"
              className="w-40 bg-transparent text-sm outline-none"
            />
          </div>
        </Form>
      </div>

      {q ? (
        <p className="mb-4 font-mono text-xs text-muted">
          {items.length} result{items.length === 1 ? "" : "s"} for “{q}”
        </p>
      ) : null}

      {pages.length ? (
        <div className="mb-4 rounded-xl border border-border bg-surface p-4">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-wide text-muted">Pages</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {pages.map((p) => (
              <li key={p.key}>
                <Link to={PAGE_HREF[p.key] ?? "/"} className="text-accent hover:underline">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-3">
        {items.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            track={tracks.find((t) => t.id === post.id)}
            queue={tracks}
          />
        ))}
        {items.length === 0 ? <p className="text-muted">Nothing here yet.</p> : null}
      </div>
    </div>
  );
}
