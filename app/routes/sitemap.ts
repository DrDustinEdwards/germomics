// /sitemap.xml — every publicly-visible post (respects publiclyVisible()/publish_at via
// listPosts) plus the key static pages. Resource route returning raw XML.
import type { Route } from "./+types/sitemap";
import { getEnv } from "~/lib/context.server";
import { listPosts } from "~/lib/posts.server";
import { xmlEscape } from "~/lib/format";

const STATIC_PATHS = [
  "",
  "episodes",
  "writing",
  "archive",
  "data",
  "games",
  "subscribe",
  "about",
  "about/dustin-edwards",
];

function isoDay(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const origin = new URL(request.url).origin;
  const posts = await listPosts(env, { limit: 1000 }); // visible only

  const urls: string[] = [];
  for (const p of STATIC_PATHS) {
    urls.push(`  <url><loc>${origin}/${p}</loc></url>`);
  }
  for (const post of posts) {
    const lastmod = isoDay(post.updatedAt) ?? isoDay(post.publishedAt);
    urls.push(
      `  <url><loc>${xmlEscape(`${origin}/${post.slug}`)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`,
    );
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
