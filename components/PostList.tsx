import PostCard from '@/components/PostCard';
import type { Post } from '@/db/schema';

export default function PostList({
  posts,
  empty = 'Nothing here yet.',
}: {
  posts: Post[];
  empty?: string;
}) {
  if (!posts.length) {
    return <p className="mt-6 text-text-secondary">{empty}</p>;
  }
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
