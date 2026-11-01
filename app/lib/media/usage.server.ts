// Where the site uses each image in BLOG_IMAGES: every place in D1 that can hold an image address, read straight from
// the tables (no reference index to fall behind), plus the one image the code itself names. Media's "used by",
// usage counts, the unattached lens and every delete come from here, so they agree.
//
// An image is referenced by its address: germomics.com/media/<key> (relative or absolute), the original or a resized
// copy. The key is read out of each address found, query and fragment cut.
import { getDb } from "~/db/index.server";
import { contentBlocks, people, posts, scheduledUpdates, settings, showConfig } from "~/db/schema";
import { imageKeyOf } from "~/lib/images";
import { DEFAULT_ARTWORK, SITE_ORIGIN } from "~/lib/site";

export type MediaPlace = { type: string; id: string; title: string; detail: string; keys: Set<string> };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const PATH = "([^\\s\"'<>()\\\\?#]+)";
const ADDRESS = new RegExp(
  `(?:^|[\\s"'(=,])(?:${escape(SITE_ORIGIN)})?/media/${PATH}`,
  "g",
);

/** The BLOG_IMAGES keys a text names by address. */
function keysIn(text: string | null | undefined): Set<string> {
  const keys = new Set<string>();
  if (!text) return keys;
  for (const m of text.matchAll(ADDRESS)) {
    const raw = (m[1] ?? "").replace(/[.,;:]+$/, "");
    try {
      keys.add(decodeURIComponent(raw));
    } catch {
      keys.add(raw);
    }
  }
  return keys;
}

const json = (v: unknown) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));

/** Every place that names at least one image, each with the keys it names and which of its fields name each. */
export async function mediaPlaces(env: Env): Promise<Array<MediaPlace & { fields: Map<string, string[]> }>> {
  const db = getDb(env);
  const [postRows, waiting, shows, persons, blocks, sets] = await Promise.all([
    db
      .select({
        slug: posts.slug,
        title: posts.title,
        body: posts.body,
        coverImage: posts.coverImage,
        ogImage: posts.ogImage,
        episodeArtwork: posts.episodeArtwork,
        guests: posts.guests,
        chapters: posts.chapters,
        sources: posts.sources,
      })
      .from(posts),
    db.select({ id: scheduledUpdates.contentId, source: scheduledUpdates.source }).from(scheduledUpdates),
    db.select({ id: showConfig.id, title: showConfig.title, artwork: showConfig.artwork, hosts: showConfig.hosts }).from(showConfig),
    db.select({ slug: people.slug, name: people.name, photo: people.photo }).from(people),
    db.select({ key: contentBlocks.key, title: contentBlocks.title, value: contentBlocks.value }).from(contentBlocks),
    db.select({ key: settings.key, label: settings.label, value: settings.value }).from(settings),
  ]);

  const places: Array<MediaPlace & { fields: Map<string, string[]> }> = [];
  const add = (type: string, id: string, title: string, named: Array<[string, unknown]>) => {
    const fields = new Map<string, string[]>();
    for (const [field, value] of named) {
      for (const key of keysIn(json(value))) fields.set(key, [...(fields.get(key) ?? []), field]);
    }
    if (fields.size === 0) return;
    places.push({ type, id, title, detail: "", keys: new Set(fields.keys()), fields });
  };

  for (const p of postRows) {
    add("post", p.slug, p.title, [
      ["cover image", p.coverImage],
      ["social image", p.ogImage],
      ["episode artwork", p.episodeArtwork],
      ["guests", p.guests],
      ["chapters", p.chapters],
      ["sources", p.sources],
      ["body", p.body],
    ]);
  }
  // An update Carrel scheduled on a live article goes live by itself, so what it names is in use now.
  for (const u of waiting) add("scheduled update", u.id, u.id, [["scheduled update", u.source]]);
  for (const s of shows) add("show", String(s.id), s.title, [["show artwork", s.artwork], ["hosts", s.hosts]]);
  for (const person of persons) add("person", person.slug, person.name, [["photo", person.photo]]);
  for (const b of blocks) add("content", b.key, b.title ?? b.key, [["text", b.value]]);
  for (const s of sets) add("setting", s.key, s.label ?? s.key, [["value", s.value]]);
  // The show artwork until show_config names one (app/lib/site.ts).
  const art = imageKeyOf(DEFAULT_ARTWORK);
  if (art) places.push({ type: "code", id: "DEFAULT_ARTWORK", title: "The show's default artwork", detail: "app/lib/site.ts", keys: new Set([art]), fields: new Map([[art, ["code"]]]) });
  return places;
}

/** The places that use one key, each with the fields that name it. */
export function usesOfKey(places: Awaited<ReturnType<typeof mediaPlaces>>, key: string) {
  return places
    .filter((p) => p.keys.has(key))
    .map((p) => ({ type: p.type, id: p.id.slice(0, 300), title: p.title.slice(0, 1000), detail: (p.detail || p.fields.get(key)!.join(", ")).slice(0, 500) }));
}

/** How many places use each key. */
export function usageCounts(places: Awaited<ReturnType<typeof mediaPlaces>>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of places) for (const key of p.keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}
