// Shared post detail view — reused by the public route ($slug) and the tokenized preview route.
// Episodes keep their existing experience (player, chapters, transcript, guests); articles get an
// editorial layout (cover, byline + reading time, table of contents, share, prev/next, related).
// Body is rendered once via BodyRenderer for both kinds.
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { Calendar, Clock, ArrowLeft, ArrowRight, FileText, Rss, Bookmark, BookmarkCheck } from "lucide-react";
import { AppLink } from "~/components/AppLink";
import type { Post } from "~/db/schema";
import type { GuestView, Host, PlayerTrack, SoundbiteView } from "~/lib/types";
import type { TocItem } from "~/lib/seo";
import { imageFor, type ImageSet } from "~/lib/images";
import { Picture } from "./Picture";
import { wasUpdatedAfterPublish } from "~/lib/seo";
import { formatDate, formatDuration } from "~/lib/format";
import { BodyRenderer } from "./BodyRenderer";
import { PostCard } from "./PostCard";
import { SoundbiteClips } from "./SoundbiteClips";
import { TranscriptPanel } from "./TranscriptPanel";
import { CopyLink, ShareTimestamp } from "./CopyLink";
import { AUTHOR } from "~/lib/about";
import { EpisodePlayerSurface } from "./EpisodePlayerSurface";
import { CoverArt } from "./CoverArt";
import {
  ReadingProgress,
  KeyMoments,
  EpisodeToc,
  Sources,
  Hosts,
  ChapterList,
  useHideBrokenFigures,
  FigureLightbox,
} from "./EpisodeExtras";
import { usePlayer } from "~/components/player/player-context";
import { PRIMARY_KEYS, SUBSCRIBE_DESTINATIONS } from "~/lib/subscribe";
import { ExternalCue } from "~/components/ExternalCue";

export type DetailData = {
  post: Post;
  track: PlayerTrack | null;
  guests: GuestView[];
  related: Post[];
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
  subscribeLinks: Record<string, string>;
  author: string;
  hosts: Host[];
  cover: string | null;
  readingMinutes: number;
  toc: TocItem[];
  soundbites?: SoundbiteView[];
  preview?: boolean;
  /** Sizes from /media for the cover, artwork and people photos the loader could size (app/lib/images.server.ts). */
  images?: ImageSet;
};

// Lightweight "save for later": a slug set in localStorage, no server. Toggles aria-pressed.
function SaveButton({ slug }: { slug: string }) {
  const KEY = "germomics-saved";
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try {
      setSaved(JSON.parse(localStorage.getItem(KEY) || "[]").includes(slug));
    } catch {
      /* ignore */
    }
  }, [slug]);
  const toggle = () => {
    try {
      const list: string[] = JSON.parse(localStorage.getItem(KEY) || "[]");
      const next = list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug];
      localStorage.setItem(KEY, JSON.stringify(next));
      setSaved(next.includes(slug));
    } catch {
      /* ignore */
    }
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      className="tap-target inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-2 font-mono text-xs text-ink hover:border-brand"
    >
      {saved ? <BookmarkCheck size={14} aria-hidden className="text-accent" /> : <Bookmark size={14} aria-hidden />}
      {saved ? "Saved" : "Save"}
    </button>
  );
}

// Compact in-page listen row: the five primary apps + RSS, links out (the footer carries the rest).
function SubscribeRow({ links }: { links: Record<string, string> }) {
  const primary = PRIMARY_KEYS.filter((k) => links[k]);
  if (!primary.length) return null;
  return (
    <section aria-labelledby="listen" className="mt-12 rounded-2xl border border-border bg-surface p-5">
      <h2 id="listen" className="mb-3 font-display text-lg font-semibold">Listen and subscribe</h2>
      <div className="flex flex-wrap gap-2">
        {primary.map((k) => {
          const d = SUBSCRIBE_DESTINATIONS[k];
          const Icon = d.icon;
          return (
            <a key={k} href={links[k]} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:border-accent hover:text-accent">
              <Icon size={14} aria-hidden /> {d.label}
              <ExternalCue />
            </a>
          );
        })}
        <a href="/feed/podcast/" target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:border-accent hover:text-accent">
          <Rss size={14} aria-hidden /> RSS
          <ExternalCue />
        </a>
        <AppLink to="/subscribe" className="inline-flex items-center rounded-full px-3 py-1.5 text-sm text-muted hover:text-ink">
          More ways to listen →
        </AppLink>
      </div>
    </section>
  );
}

export function PostDetail({ data }: { data: DetailData }) {
  const { post, track, guests, related, prev, next, subscribeLinks, readingMinutes, toc, hosts, cover } = data;
  const soundbites = data.soundbites ?? [];
  const player = usePlayer();
  const [params] = useSearchParams();
  const isEpisode = post.kind === "episode";
  const chapters = post.chapters ?? [];
  const bodyRef = useRef<HTMLDivElement>(null);
  useHideBrokenFigures(bodyRef, [post.body]);

  // Honor ?t=<seconds> deep links (share-at-timestamp landing) for episodes.
  useEffect(() => {
    const t = Number(params.get("t"));
    if (track && t > 0) {
      if (player.current?.id === track.id) player.seek(t);
      else player.playTrackAt(track, t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const GuestList = guests.length ? (
    <section className="mt-10">
      <h2 className="mb-3 font-display text-xl font-semibold">Guests</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {guests.map((g) => (
          <div key={g.slug} className="flex gap-3 rounded-xl border border-border bg-card p-4">
            {g.photo ? (
              <Picture src={g.photo} image={imageFor(data.images, "avatar", g.photo)} alt={g.photoAlt ?? g.name} loading="lazy" decoding="async" width={48} height={48} className="h-12 w-12 shrink-0 rounded-full border border-border object-cover" />
            ) : null}
            <div className="min-w-0">
              <AppLink to={`/guests/${g.slug}`} className="font-display font-medium text-ink hover:text-brand">{g.name}</AppLink>
              {g.role ? <p className="font-mono text-xs text-muted">{g.role}</p> : null}
              {g.bio ? <p className="mt-1 text-sm text-muted">{g.bio}</p> : null}
              {(g.links ?? []).length ? (
                <div className="mt-1.5 flex flex-wrap gap-2 font-mono text-[11px]">
                  {(g.links ?? []).map((l) => (
                    <a key={l.url} href={l.url} className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">{l.label || "link"}</a>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  ) : null;

  const Related = related.length ? (
    <section className="mt-12">
      <h2 className="mb-3 font-display text-xl font-semibold">Related</h2>
      <div className="grid gap-3">
        {related.map((r) => (
          <PostCard key={r.id} post={r} />
        ))}
      </div>
    </section>
  ) : null;

  const PrevNext = (prev || next) ? (
    <nav className="mt-10 flex items-stretch justify-between gap-3 border-t border-border pt-6" aria-label="More posts">
      {prev ? (
        <AppLink to={`/${prev.slug}`} className="group flex max-w-[48%] flex-col rounded-xl border border-border bg-card p-3 hover:border-brand">
          <span className="flex items-center gap-1 font-mono text-[11px] text-muted"><ArrowLeft size={12} aria-hidden /> Previous</span>
          <span className="mt-1 line-clamp-2 font-display text-sm text-ink group-hover:text-brand">{prev.title}</span>
        </AppLink>
      ) : <span />}
      {next ? (
        <AppLink to={`/${next.slug}`} className="group flex max-w-[48%] flex-col rounded-xl border border-border bg-card p-3 text-right hover:border-brand">
          <span className="flex items-center justify-end gap-1 font-mono text-[11px] text-muted">Next <ArrowRight size={12} aria-hidden /></span>
          <span className="mt-1 line-clamp-2 font-display text-sm text-ink group-hover:text-brand">{next.title}</span>
        </AppLink>
      ) : <span />}
    </nav>
  ) : null;

  // ── Episode layout (redesigned: hero, player surface, key moments, TOC + body, hosts, then the
  //     collapsed Sources/Credits + Transcript pair, subscribe, related + prev/next). See Vault
  //     episode-page-* specs. ──────────────────────────────────────────────────────────────────────
  if (isEpisode) {
    const eyebrow =
      [post.seasonNumber ? `Season ${post.seasonNumber}` : null, post.episodeNumber ? `Episode ${post.episodeNumber}` : null]
        .filter(Boolean)
        .join(" · ") || "Episode";
    const moments =
      post.keyMoments && post.keyMoments.length
        ? post.keyMoments
        : chapters.map((c) => ({ seconds: c.start, label: c.title }));
    const sources = post.sources ?? [];

    return (
      <>
        <ReadingProgress />
        <article className="mx-auto max-w-5xl">
          {data.preview ? <PreviewBanner post={post} /> : null}

          {/* Hero */}
          <header className="grid gap-6 sm:grid-cols-[1fr_12rem] sm:items-start lg:grid-cols-[1fr_14rem]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">{eyebrow}</p>
              <h1 className="mt-2 font-display text-4xl font-semibold leading-tight">{post.title}</h1>
              <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted">
                {post.publishedAt ? (
                  <span className="flex items-center gap-1">
                    <Calendar size={12} aria-hidden /> <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                  </span>
                ) : null}
                {post.audioDuration ? (
                  <span className="flex items-center gap-1 tabular-nums"><Clock size={12} aria-hidden /> {formatDuration(post.audioDuration)}</span>
                ) : null}
                {wasUpdatedAfterPublish(post) ? <span className="text-accent">Updated {formatDate(post.updatedAt)}</span> : null}
              </p>
              {post.excerpt ? <p className="mt-4 max-w-2xl font-serif text-lg leading-relaxed text-muted">{post.excerpt}</p> : null}
            </div>
            <div className="order-first w-40 sm:order-none sm:w-auto">
              <CoverArt src={cover} image={imageFor(data.images, "artwork", cover)} alt={post.coverAlt ?? "Germomics cover art"} eager className="border border-border" />
            </div>
          </header>

          {/* Player surface: the one play affordance lives on the waveform; Share and Save sit
              directly below it (the hero no longer carries a second play button). */}
          {track ? (
            <div id="player" className="mt-8 scroll-mt-20">
              <EpisodePlayerSurface track={track} peaks={post.audioPeaks ?? null} />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ShareTimestamp slug={post.slug} />
                <SaveButton slug={post.slug} />
              </div>
            </div>
          ) : null}

          {/* In this episode */}
          {track ? <KeyMoments moments={moments} track={track} /> : null}

          {/* TOC rail + article body */}
          <div className="mt-12 grid gap-8 lg:grid-cols-[15rem_1fr]">
            <div className="lg:order-1">
              <EpisodeToc items={toc} />
            </div>
            <div className="min-w-0 lg:order-2">
              {post.body ? (
                <div ref={bodyRef}>
                  <BodyRenderer html={post.body} />
                  <FigureLightbox bodyRef={bodyRef} deps={[post.body]} />
                </div>
              ) : null}
            </div>
          </div>

          {/* Everything below the body returns to a single readable measure. */}
          <div className="mx-auto max-w-3xl">
            <Hosts hosts={hosts} images={data.images} />
            {track ? <SoundbiteClips track={track} clips={soundbites} /> : null}
            {track && chapters.length ? <ChapterList chapters={chapters} track={track} /> : null}

            {/* Sources and Credits sits directly above the Transcript, both collapsed by default so they
                read as a matched pair. */}
            <Sources sources={sources} />

            {post.transcript && track ? (
              <section id="transcript" className="mt-12 scroll-mt-20">
                {/* Collapsed by default so the page opens shorter; the reader expands it. The content is
                    still server-rendered inside <details> (present in the SSR HTML for SEO/GEO), not
                    lazy-fetched on expand. The read-along only scrolls inside its own box and only while
                    open and on screen (see TranscriptPanel), so a collapsed transcript never moves the page. */}
                <details>
                  <summary className="mb-3 cursor-pointer font-display text-xl font-semibold">Transcript</summary>
                  <TranscriptPanel transcript={post.transcript} track={track} />
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

  // ── Article layout (editorial) ───────────────────────────────────────────
  return (
    <article className="mx-auto max-w-3xl">
      {data.preview ? <PreviewBanner post={post} /> : null}
      {post.coverImage ? (
        // Cover is the article LCP element — load it eagerly with high priority; the fixed aspect
        // ratio reserves space so it doesn't shift layout (CLS).
        <Picture src={post.coverImage} image={imageFor(data.images, "cover", post.coverImage)} alt={post.coverAlt ?? ""} loading="eager" fetchPriority="high" decoding="async" className="mb-6 aspect-[2/1] w-full rounded-2xl border border-border object-cover" />
      ) : null}
      <p className="flex items-center gap-1 font-mono text-xs uppercase tracking-wide text-accent">
        <FileText size={12} aria-hidden /> Article
      </p>
      <h1 className="mt-2 font-display text-4xl font-semibold leading-tight">{post.title}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted">
        <span>{AUTHOR.byline}</span>
        {post.publishedAt ? <span className="flex items-center gap-1"><Calendar size={12} aria-hidden /> {formatDate(post.publishedAt)}</span> : null}
        {wasUpdatedAfterPublish(post) ? <span className="text-accent">Updated {formatDate(post.updatedAt)}</span> : null}
        <span className="flex items-center gap-1"><Clock size={12} aria-hidden /> {readingMinutes} min read</span>
      </div>
      {(post.tags ?? []).length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(post.tags ?? []).map((t) => (
            <AppLink key={t} to={`/tag/${encodeURIComponent(t)}`} className="rounded-full border border-border px-2 py-0.5 font-mono text-[11px] text-muted hover:border-brand hover:text-brand">{t}</AppLink>
          ))}
        </div>
      ) : null}

      {toc.length >= 3 ? (
        <nav aria-label="Table of contents" className="mt-6 rounded-xl border border-border bg-surface p-4">
          <p className="mb-2 font-display text-sm font-semibold">On this page</p>
          <ol className="space-y-1 text-sm">
            {toc.map((t) => (
              <li key={t.id} className={t.level === 3 ? "pl-4" : ""}>
                <a href={`#${t.id}`} className="text-muted hover:text-accent">{t.text}</a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      {post.body ? <div className="mt-8"><BodyRenderer html={post.body} /></div> : null}

      <div className="mt-8 flex items-center gap-3">
        <CopyLink slug={post.slug} />
      </div>

      {GuestList}
      {PrevNext}
      {Related}
    </article>
  );
}

function PreviewBanner({ post }: { post: Post }) {
  return (
    <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
      <span className="font-display font-semibold">Preview</span>
      <span className="text-muted">: this is the unpublished “{post.status}” version, visible only via this link.</span>
    </div>
  );
}
