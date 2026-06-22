// /llms.txt — curated Markdown index for AI assistants, generated from D1 (always fresh).
// Served as UTF-8 plain text with X-Robots-Tag: noindex so it isn't indexed as a page.
import type { Route } from "./+types/llms";
import { getEnv } from "~/lib/context.server";
import { listEpisodes, listArticles } from "~/lib/posts.server";
import { getShowConfig } from "~/lib/show.server";
import { buildLlmsTxt } from "~/lib/discovery.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const origin = new URL(request.url).origin;
  const [show, episodes, articles] = await Promise.all([
    getShowConfig(env),
    listEpisodes(env),
    listArticles(env),
  ]);
  return new Response(buildLlmsTxt(show, episodes, articles, origin), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
