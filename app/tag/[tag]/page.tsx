import { getByTag } from '@/lib/posts';
import PostList from '@/components/PostList';
import { pageMetadata } from '@/lib/metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  const name = decodeURIComponent(tag);
  return pageMetadata({ title: `#${name}`, path: `/tag/${tag}` });
}

export default async function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params;
  const name = decodeURIComponent(tag);
  const posts = await getByTag(name);
  return (
    <div className="py-12">
      <p className="font-mono text-xs uppercase tracking-wider text-text-tertiary">Tag</p>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-text-primary">
        {name}
      </h1>
      <PostList posts={posts} empty="Nothing tagged this yet." />
    </div>
  );
}
