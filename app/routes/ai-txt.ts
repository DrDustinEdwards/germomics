// /ai.txt from Prelum's aiTxtResponse (aiTxt with its headers), the family AI usage policy (citation and search
// welcome, training reserved), with the owner's editable wording from the page:ai-txt setting. UTF-8 plain text, noindex.
import { aiTxtResponse } from "@drdustinedwards/site-helpers/robots";
import { ROBOTS_DISALLOW, SITE_ORIGIN } from "~/lib/site";
import type { Route } from "./+types/ai-txt";
import { getEnv } from "~/lib/context.server";
import { getShowConfig } from "~/lib/show.server";
import { loadPage } from "~/lib/content.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const [show, policy] = await Promise.all([getShowConfig(env), loadPage(env, "page:ai-txt")]);
  return aiTxtResponse({
    origin: SITE_ORIGIN,
    request,
    name: show.title,
    contact: show.ownerEmail,
    disallow: ROBOTS_DISALLOW,
    policy: policy.value ? policy.value.split("\n") : undefined,
  });
}
