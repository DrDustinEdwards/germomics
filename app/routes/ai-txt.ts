// /ai.txt — purpose-based AI access policy (citation/search welcome, training reserved),
// consistent with /robots.txt and the TDMRep `tdm-reservation` header. UTF-8 plain text, noindex.
import type { Route } from "./+types/ai-txt";
import { getEnv } from "~/lib/context.server";
import { getShowConfig } from "~/lib/show.server";
import { loadPage } from "~/lib/content.server";
import { buildAiTxt } from "~/lib/discovery.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const origin = new URL(request.url).origin;
  const [show, policy] = await Promise.all([getShowConfig(env), loadPage(env, "page:ai-txt")]);
  return new Response(buildAiTxt(show, origin, policy.value), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
