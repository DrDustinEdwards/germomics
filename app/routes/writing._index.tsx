import { pageHead } from "~/lib/seo";
import type { Route } from "./+types/writing._index";
import { getEnv } from "@dustinedwards/site-runtime/context";
import { listArticles } from "~/lib/posts.server";
import { ArticleCard } from "~/components/content/ArticleCard";
import { imageFor } from "~/lib/images";
import { imageSet } from "~/lib/images.server";

export function meta() {
  return pageHead({
    path: "/writing",
    title: "Writing · Germomics",
    description:
      "Germomics essays and notes on microbiology and history: outbreaks, microbes and the people who studied them.",
    pageType: "CollectionPage",
  });
}

export async function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const articles = await listArticles(env);
  return {
    articles,
    images: await imageSet(
      env,
      articles.map((a) => ["card", a.coverImage] as const),
    ),
  };
}

export default function Writing({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <header className="gm-page-header">
        <h1 className="gm-page-title">Writing</h1>
        <p className="gm-page-lede">Essays and notes on microbiology and history.</p>
      </header>
      {loaderData.articles.length === 0 ? (
        <p className="gm-muted">No articles yet.</p>
      ) : (
        <div className="gm-article-grid">
          {loaderData.articles.map((post) => (
            <ArticleCard
              key={post.id}
              post={post}
              image={imageFor(loaderData.images, "card", post.coverImage)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
