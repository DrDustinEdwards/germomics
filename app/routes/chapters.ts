// Podcasting 2.0 chapters JSON, referenced by <podcast:chapters> in the feed (editable after
// publishing because it is fetched live). Path: /:slug/chapters.json — resource route.
import type { Route } from "./+types/chapters";
import { getEnv } from "~/lib/context.server";
import { getPostBySlug, renamedPostRedirect } from "~/lib/posts.server";
import { buildChaptersJson } from "~/lib/rss.server";

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const post = await getPostBySlug(env, params.slug);
  if (!post) throw (await renamedPostRedirect(env, params.slug, "/chapters.json")) ?? new Response("Not found", { status: 404 });
  return new Response(buildChaptersJson(post), {
    headers: {
      "Content-Type": "application/json+chapters; charset=utf-8",
      // Podcast apps fetch chapters cross-origin — must be CORS-enabled.
      "Access-Control-Allow-Origin": "*",
    },
  });
}
