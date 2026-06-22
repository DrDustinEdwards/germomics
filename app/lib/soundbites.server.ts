// Soundbites: short, shareable clips of an episode (start + duration + title). Admin CRUD + the
// per-episode read for the public clip player, plus a by-episode map for the feed's
// <podcast:soundbite> tags. Drizzle only (CLAUDE.md rule #4).
import { asc, eq } from "drizzle-orm";
import { getDb } from "~/db/index.server";
import { soundbites, type Soundbite } from "~/db/schema";

export async function listSoundbites(env: Env): Promise<Soundbite[]> {
  return getDb(env)
    .select()
    .from(soundbites)
    .orderBy(asc(soundbites.postId), asc(soundbites.startSeconds));
}

export async function soundbitesForPost(env: Env, postId: number): Promise<Soundbite[]> {
  return getDb(env)
    .select()
    .from(soundbites)
    .where(eq(soundbites.postId, postId))
    .orderBy(asc(soundbites.startSeconds));
}

/** Map of episode id to its soundbites, for the feed builder. */
export async function soundbitesByEpisode(env: Env): Promise<Map<number, Soundbite[]>> {
  const all = await listSoundbites(env);
  const map = new Map<number, Soundbite[]>();
  for (const s of all) {
    const arr = map.get(s.postId) ?? [];
    arr.push(s);
    map.set(s.postId, arr);
  }
  return map;
}

export type SoundbiteInput = {
  id?: number;
  postId: number;
  startSeconds: number;
  durationSeconds: number;
  title?: string | null;
};

/** Create or update a soundbite (start clamped >= 0, duration >= 1). Returns the row id. */
export async function upsertSoundbite(env: Env, input: SoundbiteInput): Promise<number> {
  const db = getDb(env);
  const values = {
    postId: input.postId,
    startSeconds: Math.max(0, Math.floor(input.startSeconds || 0)),
    durationSeconds: Math.max(1, Math.floor(input.durationSeconds || 0)),
    title: input.title?.trim() || null,
  };
  if (input.id) {
    await db.update(soundbites).set(values).where(eq(soundbites.id, input.id));
    return input.id;
  }
  const rows = await db.insert(soundbites).values(values).returning({ id: soundbites.id });
  return rows[0].id;
}

export async function deleteSoundbite(env: Env, id: number): Promise<void> {
  await getDb(env).delete(soundbites).where(eq(soundbites.id, id));
}
