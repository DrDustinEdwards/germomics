// /robots.txt — allow crawling of public content, keep admin + preview out, point at the
// sitemap, and EXPLICITLY allow the AI citation/search crawlers (GEO: we want to be cited).
// Cloudflare's default may block AI bots at the edge — that's a dashboard setting (manual step);
// this file states our intent. Resource route returning plain text.
import type { Route } from "./+types/robots";
import { getEnv } from "~/lib/context.server";

// Citation/search crawlers we explicitly welcome. (Training-data preference is stated in
// /ai.txt + the TDMRep header; here we opt these specific bots IN to crawling public content.)
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "PerplexityBot",
  "Google-Extended",
];

const DISALLOW = ["Disallow: /admin", "Disallow: /preview/"];

export async function loader({ request, context }: Route.LoaderArgs) {
  void getEnv(context);
  const origin = new URL(request.url).origin;

  const block = (agent: string) => [`User-agent: ${agent}`, "Allow: /", ...DISALLOW, ""];

  const body = [
    "# germomics: public content is open to crawlers; admin and preview are not.",
    ...block("*"),
    "# AI citation and search crawlers, explicitly allowed (we want to be cited).",
    ...AI_CRAWLERS.flatMap(block),
    `Sitemap: ${origin}/sitemap.xml`,
    `# AI usage policy: ${origin}/ai.txt`,
    `# LLM index: ${origin}/llms.txt`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
