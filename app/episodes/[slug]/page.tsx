import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getBySlug, getByKind } from '@/lib/posts';
import { postToTrack, tracksFrom } from '@/lib/player';
import { hms, longDate, slugify } from '@/lib/format';
import { pageMetadata } from '@/lib/metadata';
import PlayButton from '@/components/player/PlayButton';
import ChapterList from '@/components/player/ChapterList';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBySlug(slug);
  if (!post) return {};
  return pageMetadata({
    title: post.seoTitle ?? post.title,
    description: post.seoDescription ?? post.excerpt ?? undefined,
    path: `/episodes/${slug}`,
    image: post.episodeArtwork ?? post.coverImage ?? undefined,
  });
}

export default async function EpisodePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await getBySlug(slug);
  if (!post || post.kind !== 'episode') notFound();

  const track = postToTrack(post);
  const allEpisodes = await getByKind('episode');
  const queue = tracksFrom(allEpisodes);
  const related = allEpisodes.filter((e) => e.id !== post.id).slice(0, 3);

  return (
    <article className="py-12">
      <p className="font-mono text-xs uppercase tracking-wider text-text-tertiary">
        {post.seasonNumber ? `Season ${post.seasonNumber} · ` : ''}
        {post.episodeNumber ? `Episode ${post.episodeNumber} · ` : ''}
        {post.publishedAt ? longDate(post.publishedAt) : ''}
        {post.audioDuration ? ` · ${hms(post.audioDuration)}` : ''}
      </p>
      <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight text-text-primary">
        {post.title}
      </h1>

      {track ? (
        <div className="mt-6">
          <PlayButton track={track} queue={queue} label="Play this episode" />
        </div>
      ) : null}

      {post.body ? (
        <div
          className="mt-10 max-w-2xl leading-relaxed text-text-primary [&_a]:text-accent [&_a]:underline-offset-4 hover:[&_a]:underline [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_p]:mt-4"
          dangerouslySetInnerHTML={{ __html: post.body }}
        />
      ) : null}

      {track && post.chapters?.length ? (
        <section className="mt-10 max-w-2xl">
          <h2 className="font-display text-sm uppercase tracking-wider text-text-secondary">Chapters</h2>
          <div className="mt-4">
            <ChapterList track={track} chapters={post.chapters} />
          </div>
        </section>
      ) : null}

      {post.guests?.length ? (
        <section className="mt-10 max-w-2xl">
          <h2 className="font-display text-sm uppercase tracking-wider text-text-secondary">Guests</h2>
          <ul className="mt-4 space-y-3">
            {post.guests.map((g) => (
              <li key={g.name}>
                <Link href={`/guests/${slugify(g.name)}`} className="font-display text-text-primary hover:text-brand">
                  {g.name}
                </Link>
                {g.role ? <span className="text-text-tertiary"> · {g.role}</span> : null}
                {g.bio ? <p className="mt-1 text-sm text-text-secondary">{g.bio}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {post.transcript ? (
        <section className="mt-10 max-w-2xl">
          <h2 className="font-display text-sm uppercase tracking-wider text-text-secondary">Transcript</h2>
          <div className="mt-4 whitespace-pre-wrap text-[0.95rem] leading-relaxed text-text-secondary">
            {post.transcript}
          </div>
        </section>
      ) : null}

      {related.length ? (
        <section className="mt-14 max-w-2xl border-t border-border pt-8">
          <h2 className="font-display text-sm uppercase tracking-wider text-text-secondary">More episodes</h2>
          <ul className="mt-4 space-y-2">
            {related.map((e) => (
              <li key={e.id}>
                <Link href={`/episodes/${e.slug}`} className="font-display text-text-primary hover:text-brand">
                  {e.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
