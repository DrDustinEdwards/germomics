import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { posts } from '@/db/schema';
import { postHref } from '@/lib/posts';
import PostEditor from '@/components/admin/PostEditor';
import { deletePost } from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = (await db.select().from(posts).where(eq(posts.id, Number(id))).limit(1))[0];
  if (!post) notFound();

  return (
    <div>
      <div className="flex items-center justify-between gap-4 pt-12">
        <Link href="/admin" className="font-mono text-xs text-text-secondary hover:text-text-primary">
          ← Library
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href={postHref(post)}
            className="font-mono text-xs text-accent underline-offset-4 hover:underline"
          >
            Preview
          </Link>
          <form action={deletePost}>
            <input type="hidden" name="id" value={post.id} />
            <button
              type="submit"
              aria-label="Delete post"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-text-tertiary hover:text-red-400"
            >
              <Trash2 size={15} aria-hidden />
            </button>
          </form>
        </div>
      </div>

      <PostEditor post={post} kind={post.kind} />
    </div>
  );
}
