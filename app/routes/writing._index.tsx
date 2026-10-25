import { pageHead } from "~/lib/seo";
import type { Route } from "./+types/writing._index";
import { getEnv } from "~/lib/context.server";
import { listArticles } from "~/lib/posts.server";
import { ArticleCard } from "~/components/content/ArticleCard";

export function meta() {
  return pageHead({ path: "/writing", title: "Writing · Germomics", description: "Essays and notes on microbiology and history." });
}

export async function loader({ context }: Route.LoaderArgs) {
  return { articles: await listArticles(getEnv(context)) };
}

export default function Writing({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <header className="mb-8">
        <h1 className="font-display text-3xl font-semibold">Writing</h1>
        <p className="mt-1 text-muted">Essays and notes on microbiology and history.</p>
      </header>
      {loaderData.articles.length === 0 ? (
        <p className="text-muted">No articles yet.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {loaderData.articles.map((post) => (
            <ArticleCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
