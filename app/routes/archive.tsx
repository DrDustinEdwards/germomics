import { Form } from "react-router";
import { Link } from "capsomer/react/link";
import { Search } from "lucide-react";
import { pageHead } from "~/lib/seo";
import type { Route } from "./+types/archive";
import { getEnv } from "~/lib/context.server";
import { listPosts, searchPosts, toPlayerTrack } from "~/lib/posts.server";
import { searchPages } from "~/lib/content.server";
import { PostCard } from "~/components/content/PostCard";
import { QueueSeeder } from "~/components/content/QueueSeeder";
import { PageHits } from "~/components/content/PageHits";

const TABS = [
  ["all", "All"],
  ["episodes", "Episodes"],
  ["writing", "Writing"],
] as const;

export function meta() {
  return pageHead({ path: "/archive", title: "Archive · Germomics", description: "Every Germomics podcast episode and written post in one place, newest first, with search to find any of them quickly.", pageType: "CollectionPage" });
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
        <Form method="get" data-keep-focus className="flex items-center gap-2">
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

      <PageHits pages={pages} className="mb-4" />

      <div className="grid gap-3">
        {items.map((post) => (
          <PostCard key={post.id} post={post} queue={tracks} heading="h2" />
        ))}
        {items.length === 0 ? <p className="text-muted">Nothing here yet.</p> : null}
      </div>
    </div>
  );
}
