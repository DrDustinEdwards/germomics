// Podcasting 2.0 chapters JSON, referenced by <podcast:chapters> in the feed (editable after
// publishing because it is fetched live). Path: /:slug/chapters.json — resource route.
import type { Route } from "./+types/chapters";
import { getEnv } from "~/lib/context.server";
import { getPostBySlug } from "~/lib/posts.server";
import { buildChaptersJson } from "~/lib/rss.server";

export async function loader({ params, context }: Route.LoaderArgs) {
  const post = await getPostBySlug(getEnv(context), params.slug);
  if (!post) throw new Response("Not found", { status: 404 });
  return new Response(buildChaptersJson(post), {
    headers: {
      "Content-Type": "application/json+chapters; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
