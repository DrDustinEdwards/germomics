// /season/:num - a real, crawlable per-season episode list (the 301 target for the old /season-1/).
// SSR; episodes ascending by episode number; its trail runs through Episodes.
import type { Route } from "./+types/season.$num";
import { getEnv } from "~/lib/context.server";
import { episodesInSeason, toPlayerTrack } from "~/lib/posts.server";
import { pageHead } from "~/lib/seo";
import { PostCard } from "~/components/content/PostCard";
import { QueueSeeder } from "~/components/content/QueueSeeder";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "Season · Germomics" }];
  const { num } = loaderData;
  return pageHead({
    path: `/season/${num}`,
    title: `Season ${num} · Germomics`,
    socialTitle: `Germomics Season ${num}`,
    description: `Germomics episodes from Season ${num}.`,
    pageType: "CollectionPage",
    breadcrumbs: [
      { name: "Germomics", path: "/" },
      { name: "Episodes", path: "/episodes" },
      { name: `Season ${num}`, path: `/season/${num}` },
    ],
  });
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const num = Number(params.num);
  if (!Number.isInteger(num) || num < 1) throw new Response("Not found", { status: 404 });
  // episodesInSeason returns card-only rows (no body/transcript/peaks): light + em-dash-free payload.
  const episodes = await episodesInSeason(getEnv(context), num);
  if (!episodes.length) throw new Response("Not found", { status: 404 });
  const tracks = episodes.map(toPlayerTrack);
  return { num, episodes, tracks };
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
          <PostCard key={post.id} post={post} queue={tracks} heading="h2" />
        ))}
      </div>
    </div>
  );
}
