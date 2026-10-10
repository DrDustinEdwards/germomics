// /llms-full.txt — fuller, still-curated concatenation of the written canonical content
// (show notes + essays + About), generated from D1. UTF-8 plain text, noindex. Not exhaustive
// and excludes transcripts (avoids the duplicate-content trap).
import type { Route } from "./+types/llms-full";
import { getEnv } from "~/lib/context.server";
import { listFullPosts } from "~/lib/posts.server";
import { getShowConfig } from "~/lib/show.server";
import { buildLlmsFullTxt } from "~/lib/discovery.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const origin = new URL(request.url).origin;
  const [show, episodes, articles] = await Promise.all([
    getShowConfig(env),
    listFullPosts(env, "episode"),
    listFullPosts(env, "article"),
  ]);
  return new Response(buildLlmsFullTxt(show, episodes, articles, origin), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
