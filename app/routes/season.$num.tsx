// /season/:num - a real, crawlable per-season episode list (the 301 target for the old /season-1/).
// SSR; episodes ascending by episode number; BreadcrumbList schema.
import type { Route } from "./+types/season.$num";
import { getEnv } from "~/lib/context.server";
import { episodesInSeason, toPlayerTrack } from "~/lib/posts.server";
import { buildBreadcrumbLd } from "~/lib/seo";
import { PostCard } from "~/components/content/PostCard";
import { QueueSeeder } from "~/components/content/QueueSeeder";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Season · germomics" }];
  const { num, origin } = loaderData;
  return [
    { title: `Season ${num} · germomics` },
    { name: "description", content: `Germomics episodes from Season ${num}.` },
    { property: "og:title", content: `germomics Season ${num}` },
    { property: "og:url", content: `${origin}/season/${num}` },
    {
      "script:ld+json": buildBreadcrumbLd([
        { name: "Home", url: `${origin}/` },
        { name: "Episodes", url: `${origin}/episodes` },
        { name: `Season ${num}`, url: `${origin}/season/${num}` },
      ]),
    },
  ];
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const num = Number(params.num);
  if (!Number.isInteger(num) || num < 1) throw new Response("Not found", { status: 404 });
  const full = await episodesInSeason(getEnv(context), num);
  if (!full.length) throw new Response("Not found", { status: 404 });
  const tracks = full.map(toPlayerTrack);
  // Card never renders body/transcript; drop them to keep the payload light + em-dash-free.
  const episodes = full.map((e) => ({ ...e, body: "", transcript: null }));
  return { num, episodes, tracks, origin: new URL(request.url).origin };
}

export default function Season({ loaderData }: Route.ComponentProps) {
  const { num, episodes, tracks } = loaderData;
  return (
    <div>
      <QueueSeeder tracks={tracks} />
      {/* Teal eyebrow is the only season marker (the page title/meta carries the heading text). */}
      <h1 className="mb-6 font-mono text-sm font-medium uppercase tracking-[0.18em] text-accent">Season {num}</h1>
      <div className="grid gap-3">
        {episodes.map((post) => (
          <PostCard key={post.id} post={post} track={tracks.find((t) => t.id === post.id)} queue={tracks} />
        ))}
      </div>
    </div>
  );
}
