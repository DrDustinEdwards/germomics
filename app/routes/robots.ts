// /robots.txt from Prelum's robotsDocument, the family bot policy: search engines and AI search agents crawl free,
// training crawlers are allowed here so Cloudflare Pay Per Crawl can charge or block them at the edge, and the
// denied bots get Disallow: /. A workers.dev or preview copy is told Disallow: / for everyone. Training rights are also reserved in /ai.txt and the TDMRep header.
import type { Route } from "./+types/robots";
import { robotsDocument } from "@drdustinedwards/site-helpers/robots";
import { HOURLY_CACHE_CONTROL } from "~/lib/edge-cache.server";
import { SITE_ORIGIN } from "~/lib/site";

export function loader({ request }: Route.LoaderArgs) {
  const body = robotsDocument({
    origin: SITE_ORIGIN,
    preview: new URL(request.url).origin !== SITE_ORIGIN,
    disallow: ["/admin", "/preview/"],
    notes: [`AI usage policy: ${SITE_ORIGIN}/ai.txt`, `LLM index: ${SITE_ORIGIN}/llms.txt`],
  });
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": HOURLY_CACHE_CONTROL },
  });
}
