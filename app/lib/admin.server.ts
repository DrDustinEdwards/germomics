// Post writes, kept apart from posts.server (reads) and only ever reached from Carrel's adapter
// (app/lib/carrel/adapter.server.ts) and the gated episode audio routes. Drizzle query builder
// throughout; guid is generated once and never rewritten (germomics invariant: immutable guid).
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "~/db/index.server";
import { posts, postVersions, type Post } from "~/db/schema";
import { AUTHOR } from "~/lib/about";

/** Who a change is recorded under: Dustin, the one writer, until Carrel sends the person who made it. */
export const CHANGE_AUTHOR = AUTHOR.name;

/** A new untitled draft with a placeholder slug, which Carrel renames. */
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

/** Snapshot the row into post_versions before a change (save, publish, rename...) overwrites it, an episode's people with it. */
export async function snapshotVersion(env: Env, post: Post, event: string): Promise<void> {
  await getDb(env).insert(postVersions).values({ postId: post.id, snapshot: post, event, author: CHANGE_AUTHOR });
}

export async function listAllPosts(env: Env): Promise<Post[]> {
  return getDb(env).select().from(posts).orderBy(desc(posts.updatedAt));
}

/** Permanent immutable feed guid, generated once at first publish. */
export function generateGuid(): string {
  return `urn:germomics:${crypto.randomUUID()}`;
}
