// /robots.txt — allow crawling of public content, keep the admin + preview out, and point at
// the sitemap. Resource route returning plain text.
import type { Route } from "./+types/robots";
import { getEnv } from "~/lib/context.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  void getEnv(context);
  const origin = new URL(request.url).origin;
  const body = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /preview/",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
