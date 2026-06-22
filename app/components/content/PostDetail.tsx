// Shared post detail view — reused by the public route ($slug) and the tokenized preview route.
// Episodes keep their existing experience (player, chapters, transcript, guests); articles get an
// editorial layout (cover, byline + reading time, table of contents, share, prev/next, related).
// Body is rendered once via BodyRenderer for both kinds.
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router";
import { Headphones, Calendar, Clock, ArrowLeft, ArrowRight, FileText } from "lucide-react";
import type { Post } from "~/db/schema";
import type { GuestView, PlayerTrack } from "~/lib/types";
import type { TocItem } from "~/lib/seo";
import { wasUpdatedAfterPublish } from "~/lib/seo";
import { formatDate, formatDuration } from "~/lib/format";
import { BodyRenderer } from "./BodyRenderer";
import { PlayButton } from "./PlayButton";
import { PostCard } from "./PostCard";
import { TranscriptPanel } from "./TranscriptPanel";
import { ShareTimestamp } from "./ShareTimestamp";
import { CopyLink } from "./CopyLink";
import { usePlayer } from "~/components/player/player-context";
import { AUTHOR } from "~/lib/about";

export type DetailData = {
  post: Post;
  track: PlayerTrack | null;
  guests: GuestView[];
  related: Post[];
  prev: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
  subscribeLinks: Record<string, string>;
  author: string;
  readingMinutes: number;
  toc: TocItem[];
  preview?: boolean;
};

export function PostDetail({ data }: { data: DetailData }) {
  const { post, track, guests, related, prev, next, subscribeLinks, readingMinutes, toc } = data;
  const player = usePlayer();
  const [params] = useSearchParams();
  const isEpisode = post.kind === "episode";
  const chapters = post.chapters ?? [];

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
              <img src={g.photo} alt={g.photoAlt ?? g.name} loading="lazy" decoding="async" width={48} height={48} className="h-12 w-12 shrink-0 rounded-full border border-border object-cover" />
            ) : null}
            <div className="min-w-0">
              <Link to={`/guests/${g.slug}`} className="font-display font-medium text-ink hover:text-brand">{g.name}</Link>
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
        <Link to={`/${prev.slug}`} className="group flex max-w-[48%] flex-col rounded-xl border border-border bg-card p-3 hover:border-brand">
          <span className="flex items-center gap-1 font-mono text-[11px] text-muted"><ArrowLeft size={12} aria-hidden /> Previous</span>
          <span className="mt-1 line-clamp-2 font-display text-sm text-ink group-hover:text-brand">{prev.title}</span>
        </Link>
      ) : <span />}
      {next ? (
        <Link to={`/${next.slug}`} className="group flex max-w-[48%] flex-col rounded-xl border border-border bg-card p-3 text-right hover:border-brand">
          <span className="flex items-center justify-end gap-1 font-mono text-[11px] text-muted">Next <ArrowRight size={12} aria-hidden /></span>
          <span className="mt-1 line-clamp-2 font-display text-sm text-ink group-hover:text-brand">{next.title}</span>
        </Link>
      ) : <span />}
    </nav>
  ) : null;

  // ── Episode layout (preserved) ───────────────────────────────────────────
  if (isEpisode) {
    return (
      <article className="mx-auto max-w-3xl">
        {data.preview ? <PreviewBanner post={post} /> : null}
        <p className="font-mono text-xs uppercase tracking-wide text-accent">Episode</p>
        <h1 className="mt-2 font-display text-4xl font-semibold leading-tight">{post.title}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted">
          {post.episodeNumber ? <span>#{post.episodeNumber}</span> : null}
          {post.seasonNumber ? <span>Season {post.seasonNumber}</span> : null}
          {post.publishedAt ? <span className="flex items-center gap-1"><Calendar size={12} aria-hidden /> {formatDate(post.publishedAt)}</span> : null}
          {wasUpdatedAfterPublish(post) ? <span className="text-accent">Updated {formatDate(post.updatedAt)}</span> : null}
          {post.audioDuration ? <span className="flex items-center gap-1 tabular-nums"><Clock size={12} aria-hidden /> {formatDuration(post.audioDuration)}</span> : null}
        </div>

        {track ? (
          <div className="mt-6 flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
            <PlayButton track={track} size="lg" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1 font-display text-sm text-brand"><Headphones size={14} aria-hidden /> Listen</span>
              <ShareTimestamp slug={post.slug} />
            </div>
          </div>
        ) : null}

        {post.body ? <div className="mt-8"><BodyRenderer html={post.body} /></div> : null}

        {chapters.length ? (
          <section className="mt-10">
            <h2 className="mb-3 font-display text-xl font-semibold">Chapters</h2>
            <ol className="grid gap-1">
              {chapters.map((c, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => (track && player.current?.id === track.id ? player.seek(c.start) : track && player.playTrackAt(track, c.start))}
                    className="flex w-full items-center gap-3 rounded px-2 py-1.5 text-left hover:bg-surface"
                  >
                    <span className="font-mono text-xs tabular-nums text-accent">{formatDuration(c.start)}</span>
                    <span>{c.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {post.transcript && track ? (
          <section className="mt-10">
            <h2 className="mb-3 font-display text-xl font-semibold">Transcript</h2>
            <TranscriptPanel transcript={post.transcript} track={track} />
          </section>
        ) : null}

        {GuestList}

        {Object.keys(subscribeLinks).length ? (
          <section className="mt-10 rounded-xl border border-border bg-surface p-4">
            <h2 className="mb-2 font-display text-sm font-semibold">Subscribe everywhere</h2>
            <div className="flex flex-wrap gap-3 font-mono text-xs">
              {Object.entries(subscribeLinks).map(([name, url]) => (
                <a key={name} href={url} className="hover:text-accent">{name}</a>
              ))}
            </div>
          </section>
        ) : null}

        {Related}
      </article>
    );
  }

  // ── Article layout (editorial) ───────────────────────────────────────────
  return (
    <article className="mx-auto max-w-3xl">
      {data.preview ? <PreviewBanner post={post} /> : null}
      {post.coverImage ? (
        // Cover is the article LCP element — load it eagerly with high priority; the fixed aspect
        // ratio reserves space so it doesn't shift layout (CLS).
        <img src={post.coverImage} alt={post.coverAlt ?? ""} loading="eager" fetchPriority="high" decoding="async" className="mb-6 aspect-[2/1] w-full rounded-2xl border border-border object-cover" />
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
            <Link key={t} to={`/tag/${encodeURIComponent(t)}`} className="rounded-full border border-border px-2 py-0.5 font-mono text-[11px] text-muted hover:border-brand hover:text-brand">{t}</Link>
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
