import { Link } from "capsomer/react/link";
import { Headphones } from "lucide-react";
import type { Route } from "./+types/_index";
import { getEnv } from "@dustinedwards/site-runtime/context";
import { getSettings, getSnippets } from "~/lib/context.server";
import { listEpisodes, listPosts, toPlayerTrack } from "~/lib/posts.server";
import { getShowConfig } from "~/lib/show.server";
import { snippet, setting, settingAddress } from "~/lib/content.server";
import { formatDate, timecode } from "capsomer/behavior/time";
import { jsonLd, sameAs, website } from "@drdustinedwards/site-helpers/schema";
import { buildOrganizationLd, buildPodcastSeriesLd, pageHead, socialSameAs } from "~/lib/seo";
import { SITE_ORIGIN } from "~/lib/site";
import { SNIPPET_DEFAULTS } from "~/lib/content-defaults";
import { PostCard } from "~/components/content/PostCard";
import { PlayTrackButton } from "capsomer/react/player";
import { QueueSeeder } from "~/components/content/QueueSeeder";
import { Ambient } from "capsomer/react/ambient";
// The hero's blobs load with the home page alone, in the cap layer.
import "capsomer/ambient-base.css";
import "capsomer/ambient-blobs.css";
import "capsomer/ambient-equalizer.css";
import { CoverArt } from "~/components/content/CoverArt";

export function meta({ loaderData }: Route.MetaArgs) {
  const head = pageHead({
    path: "/",
    title: loaderData?.homeTitle ?? SNIPPET_DEFAULTS["snippet:meta.home_title"],
    description: loaderData?.homeDescription ?? SNIPPET_DEFAULTS["snippet:meta.home_description"],
  });
  if (!loaderData?.show) return head;
  const { show, address, sameAs: profiles } = loaderData;
  return [
    ...head,
    jsonLd(buildOrganizationLd(show, { address, sameAs: profiles })),
    jsonLd(buildPodcastSeriesLd(show, { address, sameAs: profiles })),
    jsonLd(
      website({
        origin: SITE_ORIGIN,
        name: show.title,
        searchUrl: `${SITE_ORIGIN}/search?q={search_term_string}`,
      }),
    ),
  ];
}

export async function loader({ context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const [episodes, combined, show, snippets, settings] = await Promise.all([
    listEpisodes(env),
    listPosts(env, { limit: 24 }),
    getShowConfig(env),
    getSnippets(context),
    getSettings(context),
  ]);
  const tracks = episodes.map(toPlayerTrack);
  // Org/PodcastSeries sameAs = the real socials (settings social.*) + the podcast-directory
  // subscribe_links (show_config), so it stays DB-driven and never duplicates a show_config fact.
  // Prelum's sameAs keeps each absolute http(s) URL once.
  const profiles = sameAs([
    ...socialSameAs({
      facebook: setting(settings, "social.facebook"),
      twitter: setting(settings, "social.twitter"),
      instagram: setting(settings, "social.instagram"),
    }),
    ...Object.values(show.subscribeLinks ?? {}),
  ]);
  // Listing loaders already return card-only rows (no body/transcript/peaks), so the payload stays
  // light and free of long-form migrated content (the only place em dashes legitimately live).
  return {
    featured: episodes[0] ?? null,
    items: combined,
    tracks,
    show,
    address: settingAddress(settings),
    sameAs: profiles,
    homeTitle: snippet(snippets, "snippet:meta.home_title"),
    homeDescription: snippet(snippets, "snippet:meta.home_description"),
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { featured, items, tracks } = loaderData;
  const featuredTrack = tracks.find((t) => t.id === featured?.id);

  return (
    <div className="gm-home">
      <QueueSeeder tracks={tracks} />

      {/* Split hero: words on the left, the show cover (with the equalizer docked beneath it as a
          soundwave shelf) in the right ~40%, over a soft drifting brand backdrop. The backdrop
          full-bleeds the page width and fades out at the bottom (Capsomer's ambient blobs); the section
          stays relative as its positioning context but no longer clips, so the wash is not boxed.
          Columns stack on mobile (words first, then the cover). */}
      <section className="gm-hero">
        <Ambient variant="blobs" />
        <div className="gm-hero-text">
          <h1 className="gm-hero-title">
            A mix of <span className="gm-brand">microbiology</span> and{" "}
            <span className="gm-brand">history</span>.
          </h1>
          <p className="gm-hero-lede">
            This series connects different aspects of modern life and society to microbes, bacteria,
            viruses, and parasites through seemingly unconnected natural events, scientific
            discoveries, and human inventions.
          </p>
        </div>
        <div className="gm-hero-art">
          <div className="gm-hero-cover">
            <CoverArt alt="Germomics cover art" className="gm-cover-ringed" />
          </div>
          <Ambient variant="equalizer" hideOnPhone />
        </div>
      </section>

      <section>
        <div className="gm-home-head">
          <h2 className="gm-home-title">Latest</h2>
          <Link to="/archive" className="gm-home-more">
            view all →
          </Link>
        </div>
        <div className="gm-list">
          {/* Latest episode, promoted to the elevated first row of the list (same teal play chip). */}
          {featured && featuredTrack ? (
            <article className="gm-latest">
              <PlayTrackButton track={featuredTrack} queue={tracks} size="lg" />
              <div className="gm-latest-text">
                <div className="gm-latest-meta">
                  <span className="gm-latest-kind">
                    <Headphones size={12} aria-hidden /> Latest episode
                  </span>
                  {featured.publishedAt ? <span>{formatDate(featured.publishedAt)}</span> : null}
                  {featured.audioDuration ? (
                    <span className="gm-num">{timecode(featured.audioDuration * 1000)}</span>
                  ) : null}
                </div>
                <h3 className="gm-latest-title">
                  <Link to={`/${featured.slug}`} className="gm-latest-link">
                    {featured.title}
                  </Link>
                </h3>
                {featured.excerpt ? <p className="gm-index-card-text">{featured.excerpt}</p> : null}
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
