import { AppLink } from "~/components/AppLink";
import { Headphones } from "lucide-react";
import type { Route } from "./+types/_index";
import { getEnv, getSettings, getSnippets } from "~/lib/context.server";
import { listEpisodes, listPosts, toPlayerTrack } from "~/lib/posts.server";
import { getShowConfig } from "~/lib/show.server";
import { snippet, setting, settingAddress } from "~/lib/content.server";
import { formatDate, formatDuration } from "~/lib/format";
import { jsonLd, website } from "@drdustinedwards/site-helpers/schema";
import { buildOrganizationLd, buildPodcastSeriesLd, pageHead, socialSameAs } from "~/lib/seo";
import { SITE_ORIGIN } from "~/lib/site";
import { SNIPPET_DEFAULTS } from "~/lib/content-defaults";
import { PostCard } from "~/components/content/PostCard";
import { PlayButton } from "~/components/content/PlayButton";
import { QueueSeeder } from "~/components/content/QueueSeeder";
import { HeroEqualizer } from "~/components/content/HeroEqualizer";
import { HeroBackground } from "~/components/content/HeroBackground";
import { CoverArt } from "~/components/content/CoverArt";

export function meta({ loaderData }: Route.MetaArgs) {
  const head = pageHead({
    path: "/",
    title: loaderData?.homeTitle ?? SNIPPET_DEFAULTS["snippet:meta.home_title"],
    description: loaderData?.homeDescription ?? SNIPPET_DEFAULTS["snippet:meta.home_description"],
    image: loaderData?.show?.artwork,
  });
  if (!loaderData?.show) return head;
  const { show, address, sameAs } = loaderData;
  return [
    ...head,
    jsonLd(buildOrganizationLd(show, { address, sameAs })),
    jsonLd(buildPodcastSeriesLd(show, { address, sameAs })),
    jsonLd(website({ origin: SITE_ORIGIN, name: show.title, searchUrl: `${SITE_ORIGIN}/search?q={search_term_string}` })),
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
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

      {/* Split hero: words on the left, the show cover (with the equalizer docked beneath it as a
          soundwave shelf) in the right ~40%, over a soft drifting brand backdrop. The backdrop
          full-bleeds the page width and fades out at the bottom (see HeroBackground); the section
          stays relative as its positioning context but no longer clips, so the wash is not boxed.
          Columns stack on mobile (words first, then the cover). */}
      <section className="relative grid gap-8 pt-6 lg:grid-cols-5 lg:items-center">
        <HeroBackground />
        <div className="relative lg:col-span-3">
          <h1 className="max-w-3xl font-display text-5xl font-semibold leading-[1.05] sm:text-6xl">
            A mix of <span className="text-brand">microbiology</span> and <span className="text-brand">history</span>.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            This series connects different aspects of modern life and society to microbes, bacteria, viruses,
            and parasites through seemingly unconnected natural events, scientific discoveries, and human
            inventions.
          </p>
        </div>
        <div className="relative flex flex-col items-center gap-3 lg:col-span-2">
          <div className="w-44 sm:w-52">
            <CoverArt alt="Germomics cover art" className="shadow-lg ring-1 ring-border" />
          </div>
          <HeroEqualizer />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-semibold">Latest</h2>
          <AppLink to="/archive" className="font-mono text-xs text-accent hover:underline">
            view all →
          </AppLink>
        </div>
        <div className="grid gap-3">
          {/* Latest episode, promoted to the elevated first row of the list (same teal play chip). */}
          {featured && featuredTrack ? (
            <article className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm ring-1 ring-brand/10">
              <PlayButton track={featuredTrack} queue={tracks} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wide text-muted">
                  <span className="flex items-center gap-1 text-brand">
                    <Headphones size={12} aria-hidden /> Latest episode
                  </span>
                  {featured.publishedAt ? <span>{formatDate(featured.publishedAt)}</span> : null}
                  {featured.audioDuration ? (
                    <span className="tabular-nums">{formatDuration(featured.audioDuration)}</span>
                  ) : null}
                </div>
                <h3 className="mt-1 font-display text-xl font-medium">
                  <AppLink to={`/${featured.slug}`} className="text-ink hover:text-brand">
                    {featured.title}
                  </AppLink>
                </h3>
                {featured.excerpt ? (
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{featured.excerpt}</p>
                ) : null}
              </div>
            </article>
          ) : null}
          {/* The promoted episode is already shown above, so drop it from the rest of the list. */}
          {items
            .filter((post) => post.id !== featured?.id)
            .map((post) => (
              <PostCard key={post.id} post={post} queue={tracks} />
            ))}
        </div>
      </section>
    </div>
  );
}
