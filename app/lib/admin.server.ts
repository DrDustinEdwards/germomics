// Admin-only post mutations. Kept apart from posts.server (reads) and only ever reached from
// gated admin routes. Drizzle query builder throughout; guid is generated once and never
// rewritten (germomics invariant: immutable guid).
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "~/db/index.server";
import { posts, postVersions, type Post } from "~/db/schema";

export async function createDraft(env: Env, kind: "episode" | "article"): Promise<number> {
  const db = getDb(env);
  const slug = `untitled-${Date.now()}`;
  const rows = await db
    .insert(posts)
    .values({ kind, title: "Untitled", slug, status: "draft" })
    .returning({ id: posts.id });
  return rows[0].id;
}

export async function updatePost(env: Env, id: number, fields: Partial<Post>): Promise<void> {
  await getDb(env)
    .update(posts)
    .set({ ...fields, updatedAt: sql`(datetime('now'))` })
    .where(eq(posts.id, id));
}

export async function deletePost(env: Env, id: number): Promise<void> {
  await getDb(env).delete(posts).where(eq(posts.id, id));
}

/** Snapshot the current row into post_versions before an edit overwrites it. */
export async function snapshotVersion(env: Env, post: Post): Promise<void> {
  await getDb(env).insert(postVersions).values({ postId: post.id, snapshot: post });
}

export async function listVersions(env: Env, postId: number) {
  return getDb(env)
    .select({ id: postVersions.id, createdAt: postVersions.createdAt })
    .from(postVersions)
    .where(eq(postVersions.postId, postId))
    .orderBy(desc(postVersions.createdAt))
    .limit(25);
}

/** Restore a snapshot's content, preserving the immutable id/guid/createdAt. */
export async function restoreVersion(env: Env, postId: number, versionId: number): Promise<void> {
  const rows = await getDb(env)
    .select()
    .from(postVersions)
    .where(eq(postVersions.id, versionId))
    .limit(1);
  const snap = rows[0]?.snapshot as Post | undefined;
  if (!snap) return;
  const { id: _id, guid: _guid, createdAt: _c, ...rest } = snap;
  void _id;
  void _guid;
  void _c;
  await updatePost(env, postId, rest);
}

export async function listAllPosts(env: Env): Promise<Post[]> {
  return getDb(env).select().from(posts).orderBy(desc(posts.updatedAt));
}

/** Permanent immutable feed guid, generated once at first publish. */
export function generateGuid(): string {
  return `urn:germomics:${crypto.randomUUID()}`;
}
