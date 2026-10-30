// /llms.txt — curated Markdown index for AI assistants, generated from D1 (always fresh).
// Served by Prelum's llmsResponse: UTF-8 plain text with X-Robots-Tag: noindex so it isn't indexed as a page.
import { llmsResponse } from "@drdustinedwards/site-helpers/llms";
import { SITE_ORIGIN } from "~/lib/site";
import type { Route } from "./+types/llms";
import { getEnv } from "~/lib/context.server";
import { listEpisodes, listArticles } from "~/lib/posts.server";
import { getShowConfig } from "~/lib/show.server";
import { loadPage } from "~/lib/content.server";
import { buildLlmsTxt } from "~/lib/discovery.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const [show, episodes, articles, intro] = await Promise.all([
    getShowConfig(env),
    listEpisodes(env),
    listArticles(env),
    loadPage(env, "page:llms"),
  ]);
  return llmsResponse({
    origin: SITE_ORIGIN,
    request,
    body: buildLlmsTxt(show, episodes, articles, SITE_ORIGIN, intro.value),
  });
}
