// /robots.txt from Prelum's robotsResponse, the family bot policy: search engines and AI search agents crawl free,
// training crawlers are allowed here so Cloudflare Pay Per Crawl can charge or block them at the edge, and the
// denied bots get Disallow: /. A workers.dev or preview copy is told Disallow: / for everyone (and no-store).
// Training rights are also reserved in /ai.txt and the TDMRep header.
import type { Route } from "./+types/robots";
import { robotsResponse } from "@drdustinedwards/site-helpers/robots";
import { ROBOTS_DISALLOW, SITE_ORIGIN } from "~/lib/site";

export function loader({ request }: Route.LoaderArgs) {
  return robotsResponse({
    origin: SITE_ORIGIN,
    request,
    disallow: ROBOTS_DISALLOW,
    notes: [`AI usage policy: ${SITE_ORIGIN}/ai.txt`, `LLM index: ${SITE_ORIGIN}/llms.txt`],
  });
}
