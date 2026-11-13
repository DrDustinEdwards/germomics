// /search - public full-text search over posts (posts_fts) and content pages (content_blocks_fts).
// Server-rendered from the loader via ?q=, reusing the existing FTS helpers (no new query dialect).
// Results pages are noindex.
import { plural } from "@drdustinedwards/site-helpers/text";
import { Form } from "react-router";
import type { Route } from "./+types/search";
import { getEnv } from "@dustinedwards/site-runtime/context";
import { searchPosts, toPlayerTrack } from "~/lib/posts.server";
import { searchPages } from "~/lib/content.server";
import { PostCard } from "~/components/content/PostCard";
import { QueueSeeder } from "~/components/content/QueueSeeder";
import { PageHits } from "~/components/content/PageHits";

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
    <div className="gm-search">
      <QueueSeeder tracks={tracks} />
      <h1 className="gm-page-title">Search</h1>

      <Form role="search" method="get" data-keep-focus className="gm-search-form">
        <label htmlFor="q" className="cap-sr-only">
          Search Germomics
        </label>
        <input
          id="q"
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search episodes, writing, and pages"
          className="gm-search-input"
        />
        <button type="submit" className="gm-search-go">
          Go
        </button>
      </Form>

      {q ? (
        <p className="gm-search-count">
          {plural(total, "result")} for “{q}”
        </p>
      ) : null}

      <PageHits pages={pages} as="section" className="gm-search-hits" />

      <div className="gm-search-list">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} queue={tracks} heading="h2" />
        ))}
      </div>

      {q && total === 0 ? (
        <p className="gm-search-empty">Nothing matched. Try different words.</p>
      ) : null}
    </div>
  );
}
