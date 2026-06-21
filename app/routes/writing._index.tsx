import type { Route } from "./+types/writing._index";
import { getEnv } from "~/lib/context.server";
import { listArticles } from "~/lib/posts.server";
import { PostCard } from "~/components/content/PostCard";

export function meta() {
  return [
    { title: "Writing — germomics" },
    { name: "description", content: "Essays and notes on microbiology and history." },
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  return { articles: await listArticles(getEnv(context)) };
}

export default function Writing({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <h1 className="mb-6 font-display text-3xl font-semibold">Writing</h1>
      <div className="grid gap-3">
        {loaderData.articles.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
        {loaderData.articles.length === 0 ? (
          <p className="text-muted">No articles yet.</p>
        ) : null}
      </div>
    </div>
  );
}
