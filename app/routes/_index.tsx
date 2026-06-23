import { AppLink } from "~/components/AppLink";
import { Headphones } from "lucide-react";
import type { Route } from "./+types/_index";
import { getEnv, getSettings, getSnippets } from "~/lib/context.server";
import { listEpisodes, listPosts, toPlayerTrack } from "~/lib/posts.server";
import { getShowConfig } from "~/lib/show.server";
import { snippet, setting, settingAddress } from "~/lib/content.server";
import { formatDate, formatDuration } from "~/lib/format";
import { buildOrganizationLd, buildPodcastSeriesLd, buildWebSiteLd, socialSameAs } from "~/lib/seo";
import { SNIPPET_DEFAULTS } from "~/lib/content-defaults";
import { PostCard } from "~/components/content/PostCard";
import { PlayButton } from "~/components/content/PlayButton";
import { QueueSeeder } from "~/components/content/QueueSeeder";

export function meta({ loaderData }: Route.MetaArgs) {
  const base = [
    { title: loaderData?.homeTitle ?? SNIPPET_DEFAULTS["snippet:meta.home_title"] },
    { name: "description", content: loaderData?.homeDescription ?? SNIPPET_DEFAULTS["snippet:meta.home_description"] },
  ];
  if (!loaderData?.show) return base;
  const { show, origin, address, sameAs } = loaderData;
  return [
    ...base,
    { "script:ld+json": buildOrganizationLd(show, origin, { address, sameAs }) },
    { "script:ld+json": buildPodcastSeriesLd(show, origin, { address, sameAs }) },
    { "script:ld+json": buildWebSiteLd(show, origin) },
  ];
}

export async function loader({ context, request }: Route.LoaderArgs) {
  const env = getEnv(context);
  const [episodes, combined, show] = await Promise.all([
    listEpisodes(env),
    listPosts(env, { limit: 24 }),
    getShowConfig(env),
  ]);
  const snippets = getSnippets(context);
  const settings = getSettings(context);
  const tracks = episodes.map(toPlayerTrack);
  // Org/PodcastSeries sameAs = the real socials (settings social.*) + the podcast-directory
  // subscribe_links (show_config), so it stays DB-driven and never duplicates a show_config fact.
  const sameAs = [
    ...socialSameAs({
      facebook: setting(settings, "social.facebook"),
      twitter: setting(settings, "social.twitter"),
      instagram: setting(settings, "social.instagram"),
    }),
    ...Object.values(show.subscribeLinks ?? {}),
  ];
  // Listing loaders already return card-only rows (no body/transcript/peaks), so the payload stays
  // light and free of long-form migrated content (the only place em dashes legitimately live).
  return {
    featured: episodes[0] ?? null,
    items: combined,
    tracks,
    show,
    origin: new URL(request.url).origin,
    address: settingAddress(settings),
    sameAs,
    homeTitle: snippet(snippets, "snippet:meta.home_title"),
    homeDescription: snippet(snippets, "snippet:meta.home_description"),
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { featured, items, tracks } = loaderData;
  const featuredTrack = tracks.find((t) => t.id === featured?.id);

  return (
    <div className="space-y-12">
      <QueueSeeder tracks={tracks} />

      <section className="pt-6">
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">
          The purple stain, retold
        </p>
        <h1 className="mt-3 max-w-3xl font-display text-5xl font-semibold leading-[1.05] sm:text-6xl">
          Microbiology &amp; history, <span className="text-brand">in your ears</span>.
        </h1>
        {featured && featuredTrack ? (
          <div className="mt-8 flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
            <PlayButton track={featuredTrack} queue={tracks} size="lg" />
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wide text-muted">
                <span className="flex items-center gap-1 text-brand">
                  <Headphones size={12} aria-hidden /> Latest episode
                </span>
                {featured.publishedAt ? <span>{formatDate(featured.publishedAt)}</span> : null}
                {featured.audioDuration ? (
                  <span className="tabular-nums">{formatDuration(featured.audioDuration)}</span>
                ) : null}
              </div>
              <h2 className="mt-1 truncate font-display text-xl font-medium">
                <AppLink to={`/${featured.slug}`} className="hover:text-brand">
                  {featured.title}
                </AppLink>
              </h2>
            </div>
          </div>
        ) : null}
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-semibold">Latest</h2>
          <AppLink to="/archive" className="font-mono text-xs text-accent hover:underline">
            view all →
          </AppLink>
        </div>
        <div className="grid gap-3">
          {items.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              track={tracks.find((t) => t.id === post.id)}
              queue={tracks}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
