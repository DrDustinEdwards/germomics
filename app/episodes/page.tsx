import { getByKind } from '@/lib/posts';
import { tracksFrom } from '@/lib/player';
import PostList from '@/components/PostList';
import PlayButton from '@/components/player/PlayButton';
import { pageMetadata } from '@/lib/metadata';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata({ title: 'Episodes', path: '/episodes' });

export default async function EpisodesPage() {
  const episodes = await getByKind('episode');
  const tracks = tracksFrom(episodes);
  return (
    <div className="py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-text-primary">
          Episodes
        </h1>
        {tracks.length ? <PlayButton track={tracks[0]} queue={tracks} label="Play all" /> : null}
      </div>
      <PostList posts={episodes} empty="No episodes yet." />
    </div>
  );
}
