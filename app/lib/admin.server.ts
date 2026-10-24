// Admin-only post mutations. Kept apart from posts.server (reads) and only ever reached from
// gated admin routes. Drizzle query builder throughout; guid is generated once and never
// rewritten (germomics invariant: immutable guid).
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { getDb } from "~/db/index.server";
import { posts, postVersions, type Post } from "~/db/schema";

export async function createDraft(env: Env, kind: "episode" | "article"): Promise<number> {
  const db = getDb(env);
  const slug = `untitled-${crypto.randomUUID().slice(0, 8)}`;
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
    .limit(50);
}

/** Full snapshot for a single version (used by the diff viewer). */
export async function getVersion(env: Env, versionId: number): Promise<Post | null> {
  const rows = await getDb(env)
    .select()
    .from(postVersions)
    .where(eq(postVersions.id, versionId))
    .limit(1);
  return (rows[0]?.snapshot as Post | undefined) ?? null;
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

/** Duplicate a post as a fresh draft "template" — copies content, resets identity/publish state. */
export async function duplicatePost(env: Env, id: number): Promise<number> {
  const db = getDb(env);
  const rows = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  const src = rows[0];
  if (!src) throw new Response("Not found", { status: 404 });
  const {
    id: _id,
    guid: _guid,
    createdAt: _c,
    updatedAt: _u,
    publishedAt: _p,
    publishAt: _pa,
    ...rest
  } = src;
  void _id; void _guid; void _c; void _u; void _p; void _pa;
  const created = await db
    .insert(posts)
    .values({
      ...rest,
      title: `${src.title} (copy)`,
      slug: `${src.slug}-copy-${Date.now()}`,
      status: "draft",
      guid: null,
      publishedAt: null,
      publishAt: null,
    })
    .returning({ id: posts.id });
  return created[0].id;
}

/** Slug uniqueness check for inline validation (excludes the post being edited). */
export async function isSlugAvailable(env: Env, slug: string, excludeId: number): Promise<boolean> {
  const rows = await getDb(env)
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.slug, slug), ne(posts.id, excludeId)))
    .limit(1);
  return rows.length === 0;
}

/** Permanent immutable feed guid, generated once at first publish. */
export function generateGuid(): string {
  return `urn:germomics:${crypto.randomUUID()}`;
}
