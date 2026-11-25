// The post detail view, shared by the public ($slug) and the tokenized preview routes.
import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import {
  Icon,
  iconArrowLeft,
  iconArrowRight,
  iconCalendar,
  iconClock,
  iconRss,
} from "capsomer/react/icons";
import { Link } from "capsomer/react/link";
import { SaveToggle } from "capsomer/react/save-toggle";
import { SubscribeLinks } from "capsomer/react/subscribe-links";
import type { Post } from "~/db/schema";
import type { GuestView, Host, PlayerTrack, SoundbiteView } from "~/lib/types";
import type { TocItem } from "~/lib/seo";
import { imageFor, imageOrPlain, type ImageSet } from "~/lib/images";
import { Picture } from "capsomer/react/picture";
import { GMark } from "~/components/brand/GMark";
import { wasUpdatedAfterPublish } from "~/lib/seo";
import { formatDate, timecode } from "capsomer/behavior/time";
import { BodyRenderer } from "./BodyRenderer";
import { PostCard } from "./PostCard";
import { TagLinks } from "./ArticleCard";
import { SoundbiteClips } from "./SoundbiteClips";
import { CopyLink, ShareTimestamp } from "./CopyLink";
import { AUTHOR } from "~/lib/about";
import { CoverArt } from "./CoverArt";
import { EpisodeToc, Sources, useHideBrokenFigures, FigureLightbox } from "./EpisodeExtras";
import { EpisodeContext } from "./EpisodeContext";
import type { EpisodeContextView } from "~/lib/episode-context";
import {
  ChapterList,
  Hosts,
  PlayerSurface,
  PlayerTranscript,
  usePlayer,
} from "capsomer/react/player";
import { parseCueText, parseVtt } from "@drdustinedwards/site-helpers/vtt";
import { PRIMARY_KEYS, SUBSCRIBE_DESTINATIONS } from "~/lib/subscribe";
import { ExternalCue } from "~/components/ExternalCue";
import { postTrail } from "~/lib/trails";
import { toPlayerTrack } from "~/lib/posts";
import { SectionTrail } from "./SectionTrail";

export type DetailData = {
  post: Post;
  track: PlayerTrack | null;
  guests: GuestView[];
  related: Post[];
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
  subscribeLinks: Record<string, string>;
  author: string;
  authors?: string[] | null;
  series?: { name: string; part: number; of: number } | null;
  hosts: Host[];
  cover: string | null;
  readingMinutes: number;
  toc: TocItem[];
  soundbites?: SoundbiteView[];
  preview?: boolean;
  images?: ImageSet;
  context: EpisodeContextView | null;
};

// Save for later is a slug list in localStorage under germomics-saved, no server.
const SAVED_KEY = "germomics-saved";

function SubscribeRow({ links }: { links: Record<string, string> }) {
  const primary = PRIMARY_KEYS.filter((k) => links[k]);
  if (!primary.length) return null;
  return (
    <SubscribeLinks
      headingId="listen"
      links={[
        ...primary.map((k) => {
          const d = SUBSCRIBE_DESTINATIONS[k];
          return {
            href: links[k]!,
            icon: <Icon d={d.icon} />,
            label: (
              <>
                {d.label}
                <ExternalCue />
              </>
            ),
          };
        }),
        { href: "/feed/podcast/", icon: <Icon d={iconRss} />, label: "RSS" },
      ]}
      more={{ href: "/subscribe", label: "More ways to listen →" }}
      renderLink={({ href, className, children }) => (
        <Link to={href} className={className}>
          {children}
        </Link>
      )}
    />
  );
}

export function PostDetail({ data }: { data: DetailData }) {
  const {
    post,
    track,
    guests,
    related,
    prev,
    next,
    subscribeLinks,
    readingMinutes,
    toc,
    hosts,
    cover,
  } = data;
  const soundbites = data.soundbites ?? [];
  const player = usePlayer();
  const [params] = useSearchParams();
  const isEpisode = post.kind === "episode";
  const chapters = post.chapters ?? [];
  const bodyRef = useRef<HTMLDivElement>(null);
  useHideBrokenFigures(bodyRef, [post.bodyHtml]);

  useEffect(() => {
    const t = Number(params.get("t"));
    if (track && t > 0) {
      if (player.current?.id === track.id) player.seek(t);
      else player.playTrackAt(track, t);
    }
    // oxlint-disable-next-line react/exhaustive-deps -- the ?t deep link applies once, on landing
  }, []);

  const GuestList = guests.length ? (
    <section className="gm-guests">
      <h2 className="gm-post-section-title">Guests</h2>
      <div className="gm-guests-grid">
        {guests.map((g) => (
          <div key={g.slug} className="gm-guest">
            {g.photo ? (
              <Picture
                attrs={imageOrPlain(imageFor(data.images, "avatar", g.photo), g.photo, 48, 48)}
                alt={g.photoAlt ?? g.name}
                className="gm-avatar"
              />
            ) : null}
            <div className="gm-guest-text">
              <Link to={`/guests/${g.slug}`} className="gm-guest-name">
                {g.name}
              </Link>
              {g.role ? <p className="gm-meta-text">{g.role}</p> : null}
              {g.bio ? <p className="gm-guest-bio">{g.bio}</p> : null}
              {(g.links ?? []).length ? (
                <div className="gm-guest-links">
                  {(g.links ?? []).map((l) => (
                    <a key={l.url} href={l.url} className="gm-link">
                      {l.label || "link"}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  ) : null;

  const relatedTracks = related.filter((r) => r.kind === "episode").map(toPlayerTrack);
  const Related = related.length ? (
    <section className="gm-related">
      <h2 className="gm-post-section-title">Related</h2>
      <div className="gm-related-list">
        {related.map((r) => (
          <PostCard key={r.id} post={r} queue={relatedTracks} />
        ))}
      </div>
    </section>
  ) : null;

  const PrevNext =
    prev || next ? (
      <nav className="gm-prev-next" aria-label="More posts">
        {prev ? (
          <Link to={`/${prev.slug}`} className="gm-prev">
            <span className="gm-prev-next-label">
              <Icon d={iconArrowLeft} /> Previous
            </span>
            <span className="gm-prev-next-title">{prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to={`/${next.slug}`} className="gm-next">
            <span className="gm-next-label">
              Next <Icon d={iconArrowRight} />
            </span>
            <span className="gm-prev-next-title">{next.title}</span>
          </Link>
        ) : (
          <span />
        )}
      </nav>
    ) : null;

  if (isEpisode) {
    const episodeLabel = [
      post.seasonNumber ? `Season ${post.seasonNumber}` : null,
      post.episodeNumber ? `Episode ${post.episodeNumber}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    const sources = post.sources ?? [];

    return (
      <>
        {/* Capsomer's reading bar: CSS only, filling through the article below (app.css sets its look). */}
        <div className="cap-reading-progress" aria-hidden="true" />
        <article data-cap-reading className="gm-episode">
          {data.preview ? <PreviewBanner post={post} /> : null}
          <SectionTrail trail={postTrail(post)} />

          {/* Hero */}
          <header className="gm-episode-hero">
            <div>
              <h1 className="gm-post-title">{post.title}</h1>
              <p className="gm-post-meta">
                {episodeLabel ? <span className="gm-post-meta-item">{episodeLabel}</span> : null}
                {data.series ? (
                  <span className="gm-post-meta-item">{seriesLine(data.series)}</span>
                ) : null}
                {post.publishedAt ? (
                  <span className="gm-post-meta-item">
                    <Icon d={iconCalendar} />{" "}
                    <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                  </span>
                ) : null}
                {post.audioDuration ? (
                  <span className="gm-post-meta-time">
                    <Icon d={iconClock} /> {timecode(post.audioDuration * 1000)}
                  </span>
                ) : null}
                {wasUpdatedAfterPublish(post) ? (
                  <span className="gm-post-updated">Updated {formatDate(post.updatedAt)}</span>
                ) : null}
              </p>
              {post.excerpt ? <p className="gm-episode-excerpt">{post.excerpt}</p> : null}
            </div>
            <div className="gm-episode-cover">
              <CoverArt
                src={cover}
                image={imageFor(data.images, "artwork", cover)}
                alt={post.coverAlt ?? "Germomics cover art"}
                eager
                className="gm-cover-bordered"
              />
            </div>
          </header>

          {/* Player surface: the one play affordance lives on the waveform; Share and Save sit
              directly below it (the hero no longer carries a second play button). */}
          {track ? (
            <div id="player" className="gm-episode-player">
              <PlayerSurface
                track={track}
                peaks={post.audioPeaks ?? null}
                transcriptHref="#transcript"
              />
              <div className="gm-episode-actions">
                <ShareTimestamp slug={post.slug} />
                <SaveToggle storageKey={SAVED_KEY} id={post.slug} />
              </div>
            </div>
          ) : null}

          {/* The episode's one chapter list, right under the player: its chapters, from the transcript's times. */}
          {track && chapters.length ? <ChapterList track={track} /> : null}

          {/* TOC rail + article body */}
          <div className="gm-episode-columns">
            <div className="gm-episode-rail">
              <EpisodeToc items={toc} />
            </div>
            <div className="gm-episode-main">
              {data.context ? <EpisodeContext context={data.context} /> : null}
              {post.bodyHtml ? (
                <div ref={bodyRef}>
                  <BodyRenderer html={post.bodyHtml} />
                  <FigureLightbox bodyRef={bodyRef} deps={[post.bodyHtml]} />
                </div>
              ) : null}
            </div>
          </div>

          {/* Everything below the body returns to a single readable measure. */}
          <div className="gm-article">
            <Hosts
              hosts={hosts}
              avatar={(h) =>
                h.img ? (
                  <Picture
                    attrs={imageOrPlain(imageFor(data.images, "avatar", h.img), h.img, 48, 48)}
                    alt=""
                    className="gm-avatar"
                  />
                ) : (
                  <span className="gm-avatar-mark">
                    <GMark className="gm-avatar-mark-logo" />
                  </span>
                )
              }
            />
            {track ? <SoundbiteClips track={track} clips={soundbites} /> : null}

            {/* Sources and Credits sits directly above the Transcript, both collapsed by default so they
                read as a matched pair. */}
            <Sources sources={sources} />

            {post.transcript && track ? (
              <section id="transcript" className="gm-post-transcript">
                {/* Collapsed by default so the page opens shorter; the reader expands it. The content is
                    still server-rendered inside <details> (present in the SSR HTML for SEO/GEO), not
                    lazy-fetched on expand. The read-along only scrolls inside its own box and only while
                    open and on screen (see TranscriptPanel), so a collapsed transcript never moves the page. */}
                <details>
                  <summary className="gm-post-summary">Transcript</summary>
                  <PlayerTranscript
                    cues={parseVtt(post.transcript).map((cue) => {
                      const parsed = parseCueText(cue.text);
                      return {
                        ...cue,
                        ...parsed,
                        speaker: cue.speaker ?? parsed.speaker,
                      };
                    })}
                    fallback={post.transcript}
                    track={track}
                    shareUrl={(t) => `${window.location.origin}/${post.slug}?t=${Math.floor(t)}`}
                    attribution={(title, url) => `From "${title}" on Germomics: ${url}`}
                  />
                </details>
              </section>
            ) : null}

            {GuestList}
            <SubscribeRow links={subscribeLinks} />
            {Related}
            {PrevNext}
          </div>
        </article>
      </>
    );
  }

  return (
    <article className="gm-article">
      {data.preview ? <PreviewBanner post={post} /> : null}
      <SectionTrail trail={postTrail(post)} />
      {post.coverImage ? (
        // The cover is the article's LCP: eager, high priority, fixed aspect ratio against layout shift.
        <Picture
          attrs={imageOrPlain(imageFor(data.images, "cover", post.coverImage), post.coverImage)}
          alt={post.coverAlt ?? ""}
          priority
          className="gm-article-image"
        />
      ) : null}
      <h1 className="gm-post-title">{post.title}</h1>
      <div className="gm-post-meta">
        <span>
          {data.authors?.length
            ? `Written by ${new Intl.ListFormat("en").format(data.authors)}.`
            : AUTHOR.byline}
        </span>
        {data.series ? <span>{seriesLine(data.series)}</span> : null}
        {post.publishedAt ? (
          <span className="gm-post-meta-item">
            <Icon d={iconCalendar} /> {formatDate(post.publishedAt)}
          </span>
        ) : null}
        {wasUpdatedAfterPublish(post) ? (
          <span className="gm-post-updated">Updated {formatDate(post.updatedAt)}</span>
        ) : null}
        <span className="gm-post-meta-item">
          <Icon d={iconClock} /> {readingMinutes} min read
        </span>
      </div>
      <TagLinks tags={post.tags ?? []} className="gm-article-tags" />

      {toc.length >= 3 ? (
        <nav aria-label="Table of contents" className="gm-toc">
          <ol className="gm-toc-list">
            {toc.map((t) => (
              <li key={t.id} className={t.level === 3 ? "gm-toc-sub" : undefined}>
                <a href={`#${t.id}`} className="gm-toc-link">
                  {t.text}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      {post.bodyHtml ? (
        <div className="gm-article-body">
          <BodyRenderer html={post.bodyHtml} />
        </div>
      ) : null}

      <div className="gm-article-share">
        <CopyLink slug={post.slug} />
      </div>

      {GuestList}
      {PrevNext}
      {Related}
    </article>
  );
}

function seriesLine(series: NonNullable<DetailData["series"]>): string {
  return `Part ${series.part} of ${series.of}: ${series.name}`;
}

function PreviewBanner({ post }: { post: Post }) {
  return (
    <div className="gm-preview-banner">
      <span className="gm-preview-banner-title">Preview</span>
      <span className="gm-preview-banner-text">: unpublished {post.status} version.</span>
    </div>
  );
}
