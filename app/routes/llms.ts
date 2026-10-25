// /llms.txt — curated Markdown index for AI assistants, generated from D1 (always fresh).
// Served as UTF-8 plain text with X-Robots-Tag: noindex so it isn't indexed as a page.
import { SITE_ORIGIN } from "~/lib/site";
import type { Route } from "./+types/llms";
import { getEnv } from "~/lib/context.server";
import { listEpisodes, listArticles } from "~/lib/posts.server";
import { getShowConfig } from "~/lib/show.server";
import { loadPage } from "~/lib/content.server";
import { buildLlmsTxt } from "~/lib/discovery.server";
import { HOURLY_CACHE_CONTROL } from "~/lib/edge-cache.server";

export async function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const [show, episodes, articles, intro] = await Promise.all([
    getShowConfig(env),
    listEpisodes(env),
    listArticles(env),
    loadPage(env, "page:llms"),
  ]);
  return new Response(buildLlmsTxt(show, episodes, articles, SITE_ORIGIN, intro.value), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex",
      "Cache-Control": HOURLY_CACHE_CONTROL,
    },
  });
}
