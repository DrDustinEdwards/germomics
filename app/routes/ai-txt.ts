// /ai.txt from Prelum's aiTxt, the family AI usage policy (citation and search welcome, training reserved), with the
// owner's editable wording from the page:ai-txt setting. UTF-8 plain text, noindex.
import { aiTxt } from "@drdustinedwards/site-helpers/robots";
import { ROBOTS_DISALLOW, SITE_ORIGIN } from "~/lib/site";
import type { Route } from "./+types/ai-txt";
import { getEnv } from "~/lib/context.server";
import { getShowConfig } from "~/lib/show.server";
import { loadPage } from "~/lib/content.server";
import { HOURLY_CACHE_CONTROL } from "~/lib/edge-cache.server";

export async function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const [show, policy] = await Promise.all([getShowConfig(env), loadPage(env, "page:ai-txt")]);
  const body = aiTxt({
    origin: SITE_ORIGIN,
    name: show.title,
    contact: show.ownerEmail,
    disallow: ROBOTS_DISALLOW,
    policy: policy.value ? policy.value.split("\n") : undefined,
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Robots-Tag": "noindex",
      "Cache-Control": HOURLY_CACHE_CONTROL,
    },
  });
}
