import { getByKind } from '@/lib/posts';
import PostList from '@/components/PostList';
import { pageMetadata } from '@/lib/metadata';

export const dynamic = 'force-dynamic';
export const metadata = pageMetadata({ title: 'Writing', path: '/writing' });

export default async function WritingPage() {
  const articles = await getByKind('article');
  return (
    <div className="py-12">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-text-primary">
        Writing
      </h1>
      <PostList posts={articles} empty="No articles yet." />
    </div>
  );
}
