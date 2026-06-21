// Plain-text transcript for an episode, referenced by <podcast:transcript> in the feed.
// Path: /:slug/transcript.txt — resource route.
import type { Route } from "./+types/transcript";
import { getEnv } from "~/lib/context.server";
import { getPostBySlug } from "~/lib/posts.server";

export async function loader({ params, context }: Route.LoaderArgs) {
  const post = await getPostBySlug(getEnv(context), params.slug);
  if (!post?.transcript) throw new Response("Not found", { status: 404 });
  return new Response(post.transcript, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
