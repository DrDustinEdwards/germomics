// /search - public full-text search over posts (posts_fts) and content pages (content_blocks_fts).
// Server-rendered from the loader via ?q=, reusing the existing FTS helpers (no new query dialect).
// Results pages are noindex.
import { Form, Link } from "react-router";
import type { Route } from "./+types/search";
import { getEnv } from "~/lib/context.server";
import { searchPosts, toPlayerTrack } from "~/lib/posts.server";
import { searchPages } from "~/lib/content.server";
import { PostCard } from "~/components/content/PostCard";
import { QueueSeeder } from "~/components/content/QueueSeeder";

const PAGE_HREF: Record<string, string> = {
  "page:about": "/about",
  "page:dustin-edwards": "/about/dustin-edwards",
  "page:privacy": "/privacy",
  "page:terms": "/terms",
  "page:contact": "/contact",
  "page:llms": "/llms.txt",
  "page:ai-txt": "/ai.txt",
};

export function meta({ loaderData }: Route.MetaArgs) {
  const q = loaderData?.q;
  return [
    { title: q ? `Search: ${q} · Germomics` : "Search · Germomics" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) return { q, posts: [], pages: [], tracks: [] };
  const [posts, pages] = await Promise.all([searchPosts(env, q), searchPages(env, q)]);
  const tracks = posts.filter((p) => p.kind === "episode").map(toPlayerTrack);
  return { q, posts, pages, tracks };
}

export default function SearchPage({ loaderData }: Route.ComponentProps) {
  const { q, posts, pages, tracks } = loaderData;
  const total = posts.length + pages.length;
  return (
    <div className="mx-auto max-w-3xl">
      <QueueSeeder tracks={tracks} />
      <h1 className="font-display text-3xl font-semibold">Search</h1>

      <Form role="search" method="get" className="mt-4 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
        <label htmlFor="q" className="sr-only">Search Germomics</label>
        <input
          id="q"
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search episodes, writing, and pages"
          className="w-full bg-transparent outline-none"
        />
        <button type="submit" className="rounded-full bg-brand px-3 py-1 font-display text-sm text-white hover:bg-brand-strong">
          Go
        </button>
      </Form>

      {q ? (
        <p className="mt-4 font-mono text-xs text-muted">
          {total} result{total === 1 ? "" : "s"} for “{q}”
        </p>
      ) : null}

      {pages.length ? (
        <section className="mt-4 rounded-xl border border-border bg-surface p-4">
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
        </section>
      ) : null}

      <div className="mt-4 grid gap-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} track={tracks.find((t) => t.id === post.id)} queue={tracks} />
        ))}
      </div>

      {q && total === 0 ? <p className="mt-6 text-muted">Nothing matched. Try different words.</p> : null}
    </div>
  );
}
