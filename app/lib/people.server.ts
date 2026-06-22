// People = reusable guest entities (§E). Admin CRUD + episode↔person links, plus a resolver
// that turns an episode into GuestView[] for the public page — preferring the linked people,
// falling back to the legacy `guests` JSON column so the 10 migrated episodes keep working.
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "~/db/index.server";
import { people, episodePeople, posts, type Person, type Post } from "~/db/schema";
import { slugifyGuest } from "~/lib/posts";
import type { GuestView, PersonLink } from "~/lib/types";

export async function listPeople(env: Env): Promise<Person[]> {
  return getDb(env).select().from(people).orderBy(asc(people.name));
}

export async function getPerson(env: Env, id: number): Promise<Person | null> {
  const rows = await getDb(env).select().from(people).where(eq(people.id, id)).limit(1);
  return rows[0] ?? null;
}

async function uniqueSlug(env: Env, name: string, excludeId?: number): Promise<string> {
  const base = slugifyGuest(name) || "person";
  const db = getDb(env);
  let slug = base;
  for (let i = 2; i < 50; i++) {
    const rows = await db.select({ id: people.id }).from(people).where(eq(people.slug, slug)).limit(1);
    const taken = rows[0] && rows[0].id !== excludeId;
    if (!taken) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

export type PersonInput = {
  id?: number;
  name: string;
  role?: string | null;
  bio?: string | null;
  photo?: string | null;
  photoAlt?: string | null;
  links?: PersonLink[];
};

/** Create or update a person; returns the row id. Slug is derived + uniquified. */
export async function upsertPerson(env: Env, input: PersonInput): Promise<number> {
  const db = getDb(env);
  const name = input.name.trim() || "Unnamed";
  const values = {
    name,
    role: input.role?.trim() || null,
    bio: input.bio?.trim() || null,
    photo: input.photo?.trim() || null,
    photoAlt: input.photoAlt?.trim() || null,
    links: input.links ?? [],
  };
  if (input.id) {
    await db.update(people).set(values).where(eq(people.id, input.id));
    return input.id;
  }
  const slug = await uniqueSlug(env, name);
  const rows = await db
    .insert(people)
    .values({ ...values, slug })
    .returning({ id: people.id });
  return rows[0].id;
}

export async function deletePerson(env: Env, id: number): Promise<void> {
  await getDb(env).delete(people).where(eq(people.id, id));
}

export type EpisodePersonInput = { personId: number; role?: string | null; sort: number };

/** Replace the full set of people links for an episode (transactional-ish: delete then insert). */
export async function setEpisodePeople(
  env: Env,
  postId: number,
  items: EpisodePersonInput[],
): Promise<void> {
  const db = getDb(env);
  await db.delete(episodePeople).where(eq(episodePeople.postId, postId));
  if (!items.length) return;
  await db.insert(episodePeople).values(
    items.map((it) => ({
      postId,
      personId: it.personId,
      role: it.role?.trim() || null,
      sort: it.sort,
    })),
  );
}

/** Linked people for an episode, joined to the person record, ordered for display. */
export async function getEpisodePeople(
  env: Env,
  postId: number,
): Promise<Array<{ person: Person; role: string | null; sort: number }>> {
  const db = getDb(env);
  const links = await db
    .select()
    .from(episodePeople)
    .where(eq(episodePeople.postId, postId))
    .orderBy(asc(episodePeople.sort));
  if (!links.length) return [];
  const ids = links.map((l) => l.personId);
  const rows = await db.select().from(people).where(inArray(people.id, ids));
  const byId = new Map(rows.map((p) => [p.id, p]));
  return links
    .map((l) => {
      const person = byId.get(l.personId);
      return person ? { person, role: l.role, sort: l.sort } : null;
    })
    .filter((x): x is { person: Person; role: string | null; sort: number } => x !== null);
}

/** GuestView[] for the public episode page: linked people first, else legacy guests JSON. */
export async function getEpisodeGuests(env: Env, post: Post): Promise<GuestView[]> {
  if (post.kind !== "episode") return [];
  const linked = await getEpisodePeople(env, post.id);
  if (linked.length) {
    return linked.map(({ person, role }) => ({
      name: person.name,
      slug: person.slug,
      role: role ?? person.role,
      bio: person.bio,
      photo: person.photo,
      photoAlt: person.photoAlt,
      links: person.links ?? [],
    }));
  }
  // Legacy fallback — map the JSON guests onto the same view shape.
  return (post.guests ?? []).map((g) => ({
    name: g.name,
    slug: slugifyGuest(g.name),
    role: g.role ?? null,
    bio: g.bio ?? null,
    photo: g.img ?? null,
    photoAlt: null,
    link: g.link ?? null,
    links: g.link ? [{ label: "Website", url: g.link }] : [],
  }));
}

/** Episodes that feature a given person (by slug) — for the public guest page. */
export async function postsByPerson(env: Env, personSlug: string): Promise<Post[]> {
  const db = getDb(env);
  const personRows = await db.select().from(people).where(eq(people.slug, personSlug)).limit(1);
  const person = personRows[0];
  if (!person) return [];
  const links = await db
    .select({ postId: episodePeople.postId })
    .from(episodePeople)
    .where(eq(episodePeople.personId, person.id));
  if (!links.length) return [];
  const rows = await db
    .select()
    .from(posts)
    .where(and(eq(posts.kind, "episode"), inArray(posts.id, links.map((l) => l.postId))));
  return rows;
}

export async function getPersonBySlug(env: Env, slug: string): Promise<Person | null> {
  const rows = await getDb(env).select().from(people).where(eq(people.slug, slug)).limit(1);
  return rows[0] ?? null;
}
