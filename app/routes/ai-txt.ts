// /ai.txt — purpose-based AI access policy (citation/search welcome, training reserved),
// consistent with /robots.txt and the TDMRep `tdm-reservation` header. UTF-8 plain text, noindex.
import { SITE_ORIGIN } from "~/lib/site";
import type { Route } from "./+types/ai-txt";
import { getEnv } from "~/lib/context.server";
import { getShowConfig } from "~/lib/show.server";
import { loadPage } from "~/lib/content.server";
import { buildAiTxt } from "~/lib/discovery.server";
import { HOURLY_CACHE_CONTROL } from "~/lib/edge-cache.server";

export async function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const [show, policy] = await Promise.all([getShowConfig(env), loadPage(env, "page:ai-txt")]);
  return new Response(buildAiTxt(show, SITE_ORIGIN, policy.value), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex",
      "Cache-Control": HOURLY_CACHE_CONTROL,
    },
  });
}
