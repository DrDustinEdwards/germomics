import { pageHead } from "~/lib/seo";
import type { Route } from "./+types/tag.$tag";
import { getEnv } from "@dustinedwards/site-runtime/context";
import { postsByTag } from "~/lib/posts.server";
import { toPlayerTrack } from "~/lib/posts";
import { PostCard } from "~/components/content/PostCard";
import { QueueSeeder } from "~/components/content/QueueSeeder";

export function meta({ params, location }: Route.MetaArgs) {
  return pageHead({
    path: location.pathname,
    title: `#${params.tag} · Germomics`,
    description: `Germomics episodes and writing tagged ${params.tag}.`,
    pageType: "CollectionPage",
  });
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const items = await postsByTag(getEnv(context), params.tag);
  if (!items.length) throw new Response("Not found", { status: 404 });
  return {
    tag: params.tag,
    items,
    tracks: items.filter((p) => p.kind === "episode").map(toPlayerTrack),
  };
}

export default function TagPage({ loaderData }: Route.ComponentProps) {
  const { tag, items, tracks } = loaderData;
  return (
    <div>
      <QueueSeeder tracks={tracks} />
      <h1 className="gm-list-title">#{tag}</h1>
      <div className="gm-list">
        {items.map((post) => (
          <PostCard key={post.id} post={post} queue={tracks} />
        ))}
      </div>
    </div>
  );
}
