// WebVTT transcript for an episode, referenced by <podcast:transcript type="text/vtt"> in the
// feed. Path: /:slug/transcript.vtt — resource route. The stored value is raw WebVTT (verbatim
// from the source), so it is served as text/vtt with no transformation.
import type { Route } from "./+types/transcript";
import { getEnv } from "~/lib/context.server";
import { getPostBySlug, renamedPostRedirect } from "~/lib/posts.server";

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const post = await getPostBySlug(env, params.slug);
  if (!post) throw (await renamedPostRedirect(env, params.slug, "/transcript.vtt")) ?? new Response("Not found", { status: 404 });
  if (!post.transcript) throw new Response("Not found", { status: 404 });
  return new Response(post.transcript, {
    headers: {
      "Content-Type": "text/vtt; charset=utf-8",
    },
  });
}
