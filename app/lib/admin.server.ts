// Post writes, apart from posts.server (reads); reached only from Carrel's adapter and the gated episode audio routes.
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "~/db/index.server";
import { posts, postVersions, type Post } from "~/db/schema";
import { AUTHOR } from "~/lib/about";

export const CHANGE_AUTHOR = AUTHOR.name;

export async function createDraft(env: Env, kind: "episode" | "article"): Promise<number> {
  const db = getDb(env);
  const slug = `untitled-${crypto.randomUUID().slice(0, 8)}`;
  const rows = await db
    .insert(posts)
    .values({ kind, title: "Untitled", slug, status: "draft" })
    .returning({ id: posts.id });
  return rows[0].id;
}

/** Now, or one second past the stored value: datetime('now') has one-second steps, so two saves in a second would leave updated_at unchanged and the save guard would miss one. */
export const nextUpdatedAt = sql`max(datetime('now'), datetime(updated_at, '+1 second'))`;

export async function updatePost(env: Env, id: number, fields: Partial<Post>): Promise<void> {
  await getDb(env)
    .update(posts)
    .set({ ...fields, updatedAt: nextUpdatedAt })
    .where(eq(posts.id, id));
}

export async function deletePost(env: Env, id: number): Promise<void> {
  await getDb(env).delete(posts).where(eq(posts.id, id));
}

export async function snapshotVersion(
  env: Env,
  post: Post,
  event: string,
  author: string = CHANGE_AUTHOR,
): Promise<void> {
  await getDb(env).insert(postVersions).values({ postId: post.id, snapshot: post, event, author });
}

export async function listAllPosts(env: Env): Promise<Post[]> {
  return getDb(env).select().from(posts).orderBy(desc(posts.updatedAt));
}

/** Generated once at first publish and never rewritten: the immutable feed guid. */
export function generateGuid(): string {
  return `urn:germomics:${crypto.randomUUID()}`;
}
