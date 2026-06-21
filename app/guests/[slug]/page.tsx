import { getByGuest } from '@/lib/posts';
import PostList from '@/components/PostList';
import { pageMetadata } from '@/lib/metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { name } = await getByGuest(slug);
  return pageMetadata({ title: name, path: `/guests/${slug}` });
}

export default async function GuestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { name, posts } = await getByGuest(slug);
  return (
    <div className="py-12">
      <p className="font-mono text-xs uppercase tracking-wider text-text-tertiary">Guest</p>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight text-text-primary">
        {name}
      </h1>
      <PostList posts={posts} empty="No episodes with this guest yet." />
    </div>
  );
}
