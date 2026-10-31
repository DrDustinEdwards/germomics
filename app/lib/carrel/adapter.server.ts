// The site's side of Carrel's contract (@dustinedwards/site-api v0.18.0): an adapter over the writing in D1 (articles,
// episodes and the Markdown pages) and the images in the BLOG_IMAGES bucket (the media group is ./media.server.ts).
// Carrel is the only editor of the site's writing (Dustin, 2026-10-29); the admin keeps everything that is not writing.
//
// SCOPE.
//   Articles and episodes: every field a writer sets (./source.ts), from a first draft to publish, schedule, unpublish,
//     rename, trash, restore and delete. An episode is created in the germomics admin with its audio, and its audio and
//     transcript stay there (files measured or converted in the browser); Carrel puts it live once it has both. A save
//     to a live post changes the live page.
//   Pages: the content_blocks pages written in Markdown (about, the bio, privacy, terms, contact, txasm), id
//     `page.<name>` for the block `page:<name>`. Each is a route, so Carrel saves and publishes one but cannot create,
//     schedule, take down, rename or trash one. llms.txt and ai.txt are plain text (TEXT_PAGES) and stay in the admin.
//
// FIELDS. A post with no authors of its own (./source.ts) credits the show's author, in Carrel's list and author filter.
//
// RENDER. Every write renders the Markdown with Prelum (app/lib/render.server.ts) and stores the HTML beside it, with
// the reading time and the render version, which meta names (renderVersion); a source Prelum refuses (a figure without
// alt text, say) is refused with its reason and nothing is written. The guid is generated once at first publish and
// never rewritten.
//
// HISTORY. Every write first snapshots the whole row into post_versions (a page's block into content_block_versions),
// with the change and who made it; the revision list is each state a change made, newest first, named by that change.
//
// PREVIEW. The draft goes through the site's real route and layout in-process, on the request context (context.server),
// so it has the header, footer and byline; never through the Renderer, so never stored; noindex.
//
// IDS AND VERSIONS. A post's id is its slug. A version is a hash of everything Carrel can see or change (the source,
// the status and the schedule, the slug, the trash, and an update waiting on a live post), so any change anywhere,
// a rename too, gives a new version and two saves in one second cannot collide.
//
// SCHEDULES. A post scheduled before it was ever live is a published row with a future publish_at: every public read
// hides it until then (publiclyVisible), so it goes live by the clock. The one-minute cron (workers/app.ts,
// api.runSchedules) still lists it as due once its time comes, by the change that scheduled it (schedule_change_id),
// and applies it by clearing that id alone, so the publish hooks hear it go live once. An update scheduled on a LIVE
// post waits in scheduled_updates while the live version stays served, and the cron puts it live.
//
// RENAME AND TRASH. A rename moves the slug and keeps the id, so the history, people and guid move with it; the old
// slug of a post ever live redirects (301) to the new one (post_redirects, app/lib/posts.server.ts). Trash takes a live
// post off the site (a draft, trashed_at set); a restore is a draft; only a trashed post is deleted, and site-api's
// cron deletes one trashed 30 days.
import { and, eq, getTableColumns, inArray, isNotNull, lte } from "drizzle-orm";
import {
  contentVersion,
  NotFoundError,
  RefusedError,
  VersionConflictError,
  type ContentAdapter,
  type ContentSummary,
  type DueSchedule,
  type Revision,
  type ScheduledUpdate,
  type SchedulesAdapter,
  type SiteAdapter,
  type WriteResult,
} from "@dustinedwards/site-api";
import { SEARCH_FIELDS } from "@dustinedwards/site-api/frontmatter";
import { d1ScheduledUpdates, utc } from "@dustinedwards/site-api/schedules";
import { notFoundReport } from "@dustinedwards/site-runtime/not-found";
import { getDb } from "~/db/index.server";
import {
  contentBlocks,
  contentBlockVersions,
  episodePeople,
  people,
  postRedirects,
  posts,
  postVersions,
  type ContentBlock,
  type Post,
} from "~/db/schema";
import { CHANGE_AUTHOR, deletePost, generateGuid, snapshotVersion, updatePost } from "~/lib/admin.server";
import { TEXT_PAGES } from "~/lib/content.server";
import type { PagePreview } from "~/lib/context.server";
import { setEpisodePeople } from "~/lib/people.server";
import { libraryMedia, pageFields, postBodyFields, renderMarkdown, RENDER_VERSION } from "~/lib/render.server";
import { getShowConfig } from "~/lib/show.server";
import { SITE_ORIGIN } from "~/lib/site";
import { PAGE_HREF } from "~/components/content/PageHits";
import { carrelMedia } from "./media.server";
import { parsePageSource, parseSource, renderPageSource, renderSource, SourceError, type ParsedSource, type PersonRef } from "./source";

export type RenderDocument = (request: Request, draft: { post: Post } | { page: PagePreview }) => Promise<Response>;

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
// A page's id: content_blocks' `page:about` is Carrel's `page.about` (a colon is not an id character).
const PAGE_ID = /^page\.([a-z0-9-]+)$/;
const pageKeyOf = (id: string) => (PAGE_ID.test(id) ? `page:${PAGE_ID.exec(id)![1]}` : null);
const pageIdOf = (key: string) => key.replace(/^page:/, "page.");

type Status = ContentSummary["status"];
/** A post as Carrel sees it: the row, and an episode's people (in a snapshot too, since post_versions 0019). */
type Item = Post & { people?: PersonRef[] };
type Waiting = Pick<ScheduledUpdate, "publishAt" | "changeId"> | null;
/** What one write changes: the row's fields, and an episode's people when the source names them. */
type Change = { fields: Partial<Post>; people?: { personId: number; role: string | null; sort: number }[] };

// SQLite's datetime('now') is "YYYY-MM-DD HH:MM:SS" in UTC; the contract wants ISO with an offset.
const iso = (v: string | null | undefined): string | null => {
  if (!v) return null;
  const withT = v.includes("T") ? v : `${v.replace(" ", "T")}Z`;
  const d = new Date(withT);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const nowIso = () => new Date().toISOString();

function statusOf(p: Pick<Post, "status" | "publishAt">): Status {
  if (p.status !== "published") return "draft";
  return p.publishAt && p.publishAt > nowIso() ? "scheduled" : "published";
}

/** Live, or live once and taken down since: the post's address has been public. */
const everLive = (p: Post) => !!p.publishedAt && p.publishedAt <= nowIso();

const creditOf = (p: Pick<Post, "authors">, show: string): string[] => (p.authors?.length ? p.authors : [show]);

const sourceOf = (p: Item) =>
  renderSource({
    ...p,
    authors: p.authors ?? null,
    series: p.series ?? null,
    seriesPart: p.seriesPart ?? null,
    tags: p.tags ?? [],
    sources: p.sources ?? [],
    episodeType: p.episodeType ?? "full",
    explicit: p.explicit ?? false,
    chapters: p.chapters ?? [],
    keyMoments: p.keyMoments ?? [],
    guests: p.guests ?? [],
    people: p.people ?? [],
  });

/**
 * The version of a post as Carrel sees it. The trash and a waiting update join the parts only when there is one, so
 * the version of a post with neither is the hash of its source, status, schedule and slug.
 */
const versionOf = (p: Item, update: Waiting = null): Promise<string> =>
  contentVersion([
    sourceOf(p),
    p.status,
    p.publishAt ?? null,
    p.slug,
    ...(p.trashedAt ? ["trashed", p.trashedAt] : []),
    ...(update ? [update.publishAt, update.changeId] : []),
  ]);

const waitingOf = (u: ScheduledUpdate | null): Waiting => (u ? { publishAt: u.publishAt, changeId: u.changeId } : null);

async function summaryOf(p: Item, show: string, update: Waiting = null): Promise<ContentSummary> {
  return {
    scheduledUpdate: update,
    id: p.slug,
    kind: p.kind,
    title: p.title,
    status: statusOf(p),
    path: p.publishedAt ? `/${p.slug}` : null,
    publishAt: iso(p.publishAt),
    publishedAt: iso(p.publishedAt),
    updatedAt: iso(p.updatedAt),
    version: await versionOf(p, update),
    tags: p.tags ?? [],
    authors: creditOf(p, show),
    ...(p.excerpt ? { excerpt: p.excerpt } : {}),
    trashedAt: iso(p.trashedAt),
  };
}

/** A render refused by Prelum, as Carrel shows it: the reason, with the line and the fix. */
async function rendered<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    throw new RefusedError(err instanceof Error ? err.message : "The body could not be rendered.");
  }
}

const EPISODE_NEEDS = "An episode goes live with its audio and transcript, which are added in the germomics admin (/admin/episodes).";
const IN_TRASH = "This post is in the trash. Restore it first.";

const CHANGE_NAMES: Record<string, string> = {
  save: "Saved",
  publish: "Published",
  schedule: "Scheduled",
  unpublish: "Taken off the site",
  tags: "Tags set",
  trash: "Moved to the trash",
  restore: "Restored from the trash",
  "schedule.apply": "Scheduled update put live",
  "schedule.cancel": "Schedule canceled",
  audio: "Audio or transcript saved in the admin",
};

type Kept<T> = { snapshot: unknown; event: string | null; author: string | null; createdAt: string };

/** Newest first: the state after each change is the next snapshot (or the current state), the oldest snapshot last. */
async function historyOf<T>(
  rows: Kept<T>[],
  current: { state: T; version: string; at: string | null },
  versionOf: (state: T) => Promise<string>,
  nameOf: (event: string | null, before: T) => string,
): Promise<Revision[]> {
  const epoch = new Date(0).toISOString();
  const states = [...rows.map((r) => r.snapshot as T), current.state];
  const entries: Revision[] = [];
  const seen = new Set<string>();
  const add = async (r: Omit<Revision, "version">, state: T, version?: string) => {
    const v = version ?? (await versionOf(state));
    if (seen.has(v)) return;
    seen.add(v);
    entries.push({ version: v, ...r });
  };
  if (!rows.length) await add({ at: current.at ?? epoch, author: CHANGE_AUTHOR, message: "Current" }, current.state, current.version);
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    await add(
      { at: iso(r.createdAt) ?? epoch, author: r.author ?? CHANGE_AUTHOR, message: nameOf(r.event, states[i]) },
      states[i + 1],
      i === rows.length - 1 ? current.version : undefined,
    );
  }
  if (rows.length) {
    const oldest = states[0] as { updatedAt?: string | null };
    await add({ at: iso(oldest.updatedAt) ?? iso(rows[0].createdAt) ?? epoch, author: CHANGE_AUTHOR, message: "Earliest version kept" }, states[0]);
  }
  return entries;
}

const postChange = (event: string | null, before: Item) =>
  event === "rename" ? `Renamed from ${before.slug}` : (CHANGE_NAMES[event ?? ""] ?? "Saved");

// ---------- pages ----------

type PageRow = ContentBlock;
const pageVersion = (b: PageRow) => contentVersion([renderPageSource(b), b.status]);

async function pageSummary(b: PageRow): Promise<ContentSummary> {
  return {
    id: pageIdOf(b.key),
    kind: "page",
    title: b.title || b.key,
    status: b.status === "published" ? "published" : "draft",
    path: b.status === "published" ? (PAGE_HREF[b.key] ?? null) : null,
    publishAt: null,
    publishedAt: null,
    updatedAt: iso(b.updatedAt),
    version: await pageVersion(b),
    trashedAt: null,
  };
}

async function findPage(env: Env, id: string): Promise<PageRow | null> {
  const key = pageKeyOf(id);
  if (!key || TEXT_PAGES.has(key)) return null;
  const rows = await getDb(env).select().from(contentBlocks).where(and(eq(contentBlocks.key, key), eq(contentBlocks.kind, "page"))).limit(1);
  return rows[0] ?? null;
}

const pageHistory = (env: Env, key: string) =>
  getDb(env).select().from(contentBlockVersions).where(eq(contentBlockVersions.blockKey, key)).orderBy(contentBlockVersions.id);

async function listPages(env: Env): Promise<PageRow[]> {
  const rows = await getDb(env).select().from(contentBlocks).where(eq(contentBlocks.kind, "page"));
  return rows.filter((b) => !TEXT_PAGES.has(b.key));
}

export function createCarrelAdapter(
  env: Env,
  log: (entry: Record<string, unknown>) => void = console.log,
  options: { renderDocument?: RenderDocument } = {},
): SiteAdapter {
  const db = getDb(env);
  const showAuthor = async () => (await getShowConfig(env)).author;
  const updates = d1ScheduledUpdates(env.DB);
  const waiting = async (slug: string): Promise<Waiting> => waitingOf(await updates.get(slug));

  // Carrel's changeId joins its authorship record to this site's history. posts has no column for
  // it, so it is written to the Worker log with the id and the new version, and returned to Carrel.
  const recordChange = (event: string, id: string, version: string, changeId: string) =>
    log({ event: `carrel.${event}`, id, version, changeId });

  /** Each episode's people by its post id, in order, as the source names them. */
  async function peopleOf(ids: number[]): Promise<Map<number, PersonRef[]>> {
    const out = new Map<number, PersonRef[]>();
    if (!ids.length) return out;
    const rows = await db
      .select({ postId: episodePeople.postId, slug: people.slug, role: episodePeople.role })
      .from(episodePeople)
      .innerJoin(people, eq(people.id, episodePeople.personId))
      .where(inArray(episodePeople.postId, ids))
      .orderBy(episodePeople.sort);
    for (const r of rows) out.set(r.postId, [...(out.get(r.postId) ?? []), { slug: r.slug, role: r.role }]);
    return out;
  }

  const withPeople = async (rows: Post[]): Promise<Item[]> => {
    const byPost = await peopleOf(rows.filter((p) => p.kind === "episode").map((p) => p.id));
    return rows.map((p) => (p.kind === "episode" ? { ...p, people: byPost.get(p.id) ?? [] } : p));
  };

  async function findPost(slug: string): Promise<Item | null> {
    const rows = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
    return rows[0] ? (await withPeople(rows))[0] : null;
  }

  /** The save rules applied to a Carrel source: the body rendered with its reading time, and the fields it holds. */
  async function changeFromSource(source: string, kind: Post["kind"]): Promise<Change> {
    let parsed;
    try {
      parsed = parseSource(source, kind);
    } catch (err) {
      throw new RefusedError(err instanceof SourceError ? err.message : "The source could not be read.");
    }
    const fields: Partial<Post> = { ...(await rendered(() => postBodyFields(env, parsed.body))), ...parsed.post };
    if (!parsed.episode) return { fields };
    const { people: refs = [], ...episode } = parsed.episode;
    Object.assign(fields, episode);
    const slugs = refs.map((r) => r.slug);
    const found = slugs.length ? await db.select({ id: people.id, slug: people.slug }).from(people).where(inArray(people.slug, slugs)) : [];
    const ids = new Map(found.map((p) => [p.slug, p.id]));
    const unknown = slugs.filter((s) => !ids.has(s));
    if (unknown.length) throw new RefusedError(`No one in the germomics People list (/admin/people) has the slug ${unknown.join(", ")}.`);
    return { fields, people: refs.map((r, sort) => ({ personId: ids.get(r.slug)!, role: r.role, sort })) };
  }

  // `dropUpdate`: a publish, an unpublish or a trash drops an update waiting on the post, so the cron
  // never brings back what was just published over or taken down.
  async function write(
    event: string,
    slug: string,
    changeId: string,
    expectedVersion: string | null,
    build: (current: Item | null) => Promise<Change>,
    { dropUpdate = false } = {},
  ): Promise<WriteResult> {
    const current = await findPost(slug);
    const update = current ? await waiting(slug) : null;
    const version = current ? await versionOf(current, update) : null;
    if (version !== expectedVersion) throw new VersionConflictError(version);
    if (!current && (!ID_PATTERN.test(slug) || PAGE_ID.test(slug))) throw new RefusedError("That id cannot be used as a slug.");
    const { fields, people: links } = await build(current);
    let id: number;
    if (current) {
      await snapshotVersion(env, current, event);
      await updatePost(env, current.id, fields);
      id = current.id;
    } else {
      const created = await db
        .insert(posts)
        .values({ kind: "article", title: "Untitled", slug, status: "draft", ...fields })
        .returning({ id: posts.id });
      id = created[0].id;
    }
    if (links) await setEpisodePeople(env, id, links);
    const finalSlug = fields.slug ?? slug;
    if (update && dropUpdate) await updates.remove(finalSlug).run();
    const left = dropUpdate ? null : update;
    const row = (await findPost(finalSlug))!;
    const next = await versionOf(row, left);
    recordChange(event, finalSlug, next, changeId);
    return { id: finalSlug, version: next, status: statusOf(row), changeId, scheduledUpdate: left };
  }

  /** The fields that put a post live, or schedule it: an episode needs its audio and transcript first. */
  async function goingLive(current: Item | null, source: string | undefined): Promise<Change> {
    if (!current) throw new NotFoundError();
    if (current.trashedAt) throw new RefusedError(IN_TRASH);
    if (current.kind === "episode" && (!current.audioUrl || !current.transcript?.trim())) throw new RefusedError(EPISODE_NEEDS);
    const change = source !== undefined ? await changeFromSource(source, current.kind) : { fields: {} };
    return { ...change, fields: { ...change.fields, status: "published", guid: current.guid ?? generateGuid() } };
  }

  /** A page's write: the version checked, then the change. A page is never created here. */
  async function writePage(
    event: string,
    id: string,
    changeId: string,
    expectedVersion: string | null,
    build: (current: PageRow) => Promise<Partial<PageRow>>,
  ): Promise<WriteResult> {
    const current = await findPage(env, id);
    const now = current ? await pageVersion(current) : null;
    if (now !== expectedVersion) throw new VersionConflictError(now);
    if (!current) throw new RefusedError("A germomics page is a route of its own, so Carrel edits the pages it lists and adds none.");
    const fields = await build(current);
    await db.insert(contentBlockVersions).values({ blockKey: current.key, snapshot: current, event, author: CHANGE_AUTHOR });
    await db.update(contentBlocks).set({ ...fields, updatedAt: nowIso() }).where(eq(contentBlocks.key, current.key));
    const next = { ...current, ...fields };
    const version = await pageVersion(next);
    recordChange(event, id, version, changeId);
    return { id, version, status: next.status === "published" ? "published" : "draft", changeId };
  }

  async function pageSourceFields(source: string): Promise<Partial<PageRow>> {
    let parsed;
    try {
      parsed = parsePageSource(source);
    } catch (err) {
      throw new RefusedError(err instanceof Error ? err.message : "The source could not be read.");
    }
    return {
      ...(parsed.title !== null ? { title: parsed.title.trim() || null } : {}),
      ...(await rendered(() => pageFields(env, parsed.body))),
    };
  }

  const refusedForPage = (what: string) => () =>
    Promise.reject(new RefusedError(`Every germomics page is a live route, so it cannot be ${what}. Publish a new version instead.`));

  /** A page id is never renamed, trashed or deleted; anything else must be a post that exists. */
  async function existingPost(id: string, what: string): Promise<Item> {
    if (await findPage(env, id)) throw new RefusedError(`Every germomics page is a live route, so it cannot be ${what}.`);
    const current = await findPost(id);
    if (!current) throw new NotFoundError();
    return current;
  }

  /** The post a source would make, never written: over the stored row when there is one, noindex either way. */
  async function draftPost(id: string | undefined, source: string): Promise<Post> {
    const current = id ? await findPost(id) : null;
    const kind = current?.kind ?? "article";
    let parsed: ParsedSource;
    try {
      parsed = parseSource(source, kind);
    } catch {
      parsed = { body: source, post: null, episode: null };
    }
    const { people: _people, ...episode } = parsed.episode ?? {};
    const now = nowIso();
    const blank = Object.fromEntries(Object.keys(getTableColumns(posts)).map((column) => [column, null]));
    const base = current ?? ({ ...blank, id: 0, kind, title: "Untitled", body: "", status: "draft", tags: [], featured: false, createdAt: now, updatedAt: now } as unknown as Post);
    return {
      ...base,
      ...parsed.post,
      ...episode,
      ...(await rendered(() => postBodyFields(env, parsed.body))),
      slug: current?.slug ?? (id && ID_PATTERN.test(id) ? id : "preview"),
      noindex: true,
    };
  }

  const content: ContentAdapter = {
    // site-api's post and search fields this site renders (./source.ts): the excerpt, and the search title,
    // description, image and its alt text, kept in seo_title, seo_description, og_image and og_image_alt, and the
    // canonical address and noindex in their own columns; authors, series and seriesPart.
    postFields: ["excerpt", "authors", "series", "seriesPart"],
    searchFields: SEARCH_FIELDS,
    // A page has no tags, authors or publish date, so a tag, author or date filter leaves the pages out.
    filters: ["kind", "tag", "author", "published"],
    publishedAtSettable: true,

    async list(query) {
      const { status, q, kind, tag, author, publishedAfter, publishedBefore, trashed = false, cursor, limit } = query;
      const show = await showAuthor();
      const needle = q?.toLowerCase();
      const after = publishedAfter ? new Date(publishedAfter).toISOString() : null;
      const before = publishedBefore ? new Date(publishedBefore).toISOString() : null;
      const rows = (await db.select().from(posts)).filter((p) => {
        const published = iso(p.publishedAt);
        return (
          ID_PATTERN.test(p.slug) &&
          !!p.trashedAt === trashed &&
          (!kind || p.kind === kind) &&
          (!tag || (p.tags ?? []).includes(tag)) &&
          (!author || creditOf(p, show).includes(author)) &&
          (!after || (published !== null && published >= after)) &&
          (!before || (published !== null && published <= before)) &&
          (!needle || [p.title, p.slug, p.body].some((t) => t.toLowerCase().includes(needle))) &&
          (!status || statusOf(p) === status)
        );
      });
      const pages =
        trashed || tag || author || after || before || (kind && kind !== "page")
          ? []
          : (await listPages(env)).filter(
              (b) =>
                (!status || (b.status === "published" ? "published" : "draft") === status) &&
                (!needle || [b.title ?? "", b.key, b.value].some((t) => t.toLowerCase().includes(needle))),
            );
      const all = [
        ...rows.map((p) => ({ post: p, page: null, updated: iso(p.updatedAt), published: iso(p.publishedAt), title: p.title })),
        ...pages.map((b) => ({ post: null, page: b, updated: iso(b.updatedAt), published: null, title: b.title || b.key })),
      ];
      const sort = query.sort ?? "updated";
      const dir = query.dir ?? (sort === "title" ? "asc" : "desc");
      const key = (i: (typeof all)[number]) => (sort === "title" ? i.title.toLowerCase() : (i[sort] ?? ""));
      all.sort((a, b) => key(a).localeCompare(key(b)) * (dir === "asc" ? 1 : -1));
      const start = Math.max(0, Number(cursor) || 0);
      const shown = all.slice(start, start + limit);
      // Only the page shown is read in full: its episodes' people and its waiting updates.
      const full = new Map((await withPeople(shown.flatMap((i) => (i.post ? [i.post] : [])))).map((p) => [p.id, p]));
      const items = await Promise.all(
        shown.map(async (i) => (i.post ? summaryOf(full.get(i.post.id)!, show, await waiting(i.post.slug)) : pageSummary(i.page!))),
      );
      return { items, nextCursor: start + limit < all.length ? String(start + limit) : null, total: all.length, sorted: { sort, dir } };
    },

    async get(id) {
      const b = await findPage(env, id);
      if (b) return { ...(await pageSummary(b)), format: "markdown" as const, source: renderPageSource(b), version: await pageVersion(b) };
      const p = await findPost(id);
      if (!p) return null;
      const update = await waiting(id);
      return { ...(await summaryOf(p, await showAuthor(), update)), format: "markdown" as const, source: sourceOf(p), version: await versionOf(p, update) };
    },

    // A new id is a new article: an episode starts in the admin, with its audio.
    saveDraft: (id, input) =>
      pageKeyOf(id)
        ? writePage("save", id, input.changeId, input.expectedVersion, () => pageSourceFields(input.source))
        : write("save", id, input.changeId, input.expectedVersion, async (current) => {
            const change = await changeFromSource(input.source, current?.kind ?? "article");
            return current ? change : { ...change, fields: { ...change.fields, status: "draft" } };
          }),

    // A first publish from Carrel's key is allowed (Carrel design decision 2). The guid is made once here and never
    // rewritten. The date is the one Carrel sends (a backdate, or a new date for a live post), else the date the post
    // first went live, else now.
    publish: (id, input) =>
      pageKeyOf(id)
        ? writePage("publish", id, input.changeId, input.expectedVersion, async (current) => {
            if (input.publishedAt) throw new RefusedError("A germomics page has no publish date.");
            return {
              ...(input.source !== undefined ? await pageSourceFields(input.source) : {}),
              ...(current.renderVersion === null ? await rendered(() => pageFields(env, current.value)) : {}),
              status: "published",
            };
          })
        : write("publish", id, input.changeId, input.expectedVersion, async (current) => {
            const change = await goingLive(current, input.source);
            const was = current && everLive(current) ? current.publishedAt : null;
            const publishedAt = input.publishedAt ? new Date(input.publishedAt).toISOString() : (was ?? nowIso());
            return { ...change, fields: { ...change.fields, publishedAt, publishAt: null, scheduleChangeId: null } };
          }, { dropUpdate: true }),

    schedule: (id, input) =>
      pageKeyOf(id)
        ? writePage("schedule", id, input.changeId, input.expectedVersion, refusedForPage("scheduled"))
        : write("schedule", id, input.changeId, input.expectedVersion, async (current) => {
            const change = await goingLive(current, input.source);
            const at = utc(input.publishAt);
            return { ...change, fields: { ...change.fields, publishAt: at, publishedAt: at, scheduleChangeId: input.changeId } };
          }),

    unpublish: (id, input) =>
      pageKeyOf(id)
        ? writePage("unpublish", id, input.changeId, input.expectedVersion, refusedForPage("taken down"))
        : write("unpublish", id, input.changeId, input.expectedVersion, async (current) => {
            if (!current) throw new NotFoundError();
            return { fields: { status: "draft", publishAt: null, scheduleChangeId: null } };
          }, { dropUpdate: true }),

    async setTags(id, { tags, expectedVersion, changeId }) {
      if (await findPage(env, id)) throw new RefusedError("A germomics page has no tags.");
      const current = await existingPost(id, "tagged");
      if (current.trashedAt) throw new RefusedError(IN_TRASH);
      return write("tags", id, changeId, expectedVersion, async () => ({ fields: { tags } }));
    },

    // The slug moves and the row stays, so the history, the people and the guid move with it. The old address of a
    // post ever live redirects to the new one; a slug taken by another post or a page id is refused.
    async rename(id, { newId, expectedVersion, changeId }) {
      const current = await existingPost(id, "renamed");
      if (current.trashedAt) throw new RefusedError(IN_TRASH);
      if (!ID_PATTERN.test(newId) || PAGE_ID.test(newId)) throw new RefusedError("That id cannot be used as a slug.");
      const version = await versionOf(current, await waiting(id));
      if (version !== expectedVersion) throw new VersionConflictError(version);
      if (newId !== id && (await findPost(newId))) throw new RefusedError(`Another post already has the slug ${newId}.`);
      const result = await write("rename", id, changeId, expectedVersion, async () => ({ fields: { slug: newId } }));
      await env.DB.prepare("UPDATE scheduled_updates SET content_id = ? WHERE content_id = ?").bind(newId, id).run();
      // The new slug is a post's again, so it no longer redirects; the old one does where readers may hold it.
      await db.delete(postRedirects).where(eq(postRedirects.fromSlug, newId));
      const previousPath = everLive(current) ? `/${id}` : null;
      if (previousPath) {
        await db
          .insert(postRedirects)
          .values({ fromSlug: id, postId: current.id })
          .onConflictDoUpdate({ target: postRedirects.fromSlug, set: { postId: current.id } });
      }
      return { ...result, scheduledUpdate: (await waiting(newId)) ?? null, previousPath };
    },

    // Trash takes a live post off the site in the same write, dropping a waiting update.
    async trash(id, { expectedVersion, changeId }) {
      const current = await existingPost(id, "trashed");
      if (current.trashedAt) throw new RefusedError("This post is already in the trash.");
      return write("trash", id, changeId, expectedVersion, async () => ({
        fields: { trashedAt: nowIso(), status: "draft", publishAt: null, scheduleChangeId: null },
      }), { dropUpdate: true });
    },

    // Always a draft: a restore never republishes.
    async restore(id, { expectedVersion, changeId }) {
      const current = await existingPost(id, "restored");
      if (!current.trashedAt) throw new RefusedError("This post is not in the trash.");
      return write("restore", id, changeId, expectedVersion, async () => ({ fields: { trashedAt: null, status: "draft" } }));
    },

    // For good, and only from the trash: the row, its snapshots, people and redirects (cascade) and any waiting update.
    async delete(id, { expectedVersion, changeId }) {
      const current = await existingPost(id, "deleted");
      const version = await versionOf(current, await waiting(id));
      if (version !== expectedVersion) throw new VersionConflictError(version);
      if (!current.trashedAt) throw new RefusedError("Move this post to the trash first; the trash is deleted after 30 days.");
      await updates.remove(id).run();
      await deletePost(env, current.id);
      recordChange("delete", id, version, changeId);
    },

    async revisions(id) {
      const b = await findPage(env, id);
      if (b) {
        const current = { state: b, version: await pageVersion(b), at: iso(b.updatedAt) };
        return historyOf(await pageHistory(env, b.key), current, pageVersion, (event) => CHANGE_NAMES[event ?? ""] ?? "Saved");
      }
      const p = await findPost(id);
      if (!p) return null;
      const rows = await db.select().from(postVersions).where(eq(postVersions.postId, p.id)).orderBy(postVersions.id);
      const current = { state: p, version: await versionOf(p, await waiting(id)), at: iso(p.updatedAt) };
      return historyOf<Item>(rows, current, (snap) => versionOf(snap), postChange);
    },

    async revisionSource(id, version) {
      const b = await findPage(env, id);
      if (b) {
        if ((await pageVersion(b)) === version) return renderPageSource(b);
        for (const r of await pageHistory(env, b.key)) {
          const snap = r.snapshot as PageRow;
          if ((await pageVersion(snap)) === version) return renderPageSource(snap);
        }
        return null;
      }
      const p = await findPost(id);
      if (!p) return null;
      if ((await versionOf(p, await waiting(id))) === version) return sourceOf(p);
      const rows = await db.select().from(postVersions).where(eq(postVersions.postId, p.id));
      for (const r of rows) {
        const snap = r.snapshot as Item;
        if ((await versionOf(snap)) === version) return sourceOf(snap);
      }
      return null;
    },
  };

  // Updates scheduled on live posts (site-api v0.10.0), kept in scheduled_updates, and the first publishes the clock
  // makes (above, SCHEDULES).
  const schedules: SchedulesAdapter = {
    async get(id) {
      return (await findPost(id)) ? updates.get(id) : null;
    },

    async update(id, { source, publishAt, expectedVersion, changeId }) {
      const current = await findPost(id);
      if (!current) throw new NotFoundError();
      const before = await waiting(id);
      const version = await versionOf(current, before);
      if (version !== expectedVersion) throw new VersionConflictError(version);
      if (statusOf(current) !== "published") throw new RefusedError("Only a live post takes a scheduled update.");
      await changeFromSource(source, current.kind); // refused now, not at the time, when it cannot be read or rendered
      await updates.put(id, { source, publishAt, changeId }).run();
      const update = { publishAt: utc(publishAt), changeId };
      const next = await versionOf(current, update);
      recordChange("schedule.update", id, next, changeId);
      return { id, version: next, status: "published", changeId, scheduledUpdate: update };
    },

    async cancel(id, { expectedVersion, changeId }) {
      const current = await findPost(id);
      if (!current) throw new NotFoundError();
      const update = await waiting(id);
      const version = await versionOf(current, update);
      if (version !== expectedVersion) throw new VersionConflictError(version);
      if (update) {
        await updates.remove(id).run();
        const next = await versionOf(current, null);
        recordChange("schedule.cancel", id, next, changeId);
        return { id, version: next, status: statusOf(current), changeId, scheduledUpdate: null };
      }
      if (statusOf(current) !== "scheduled") throw new RefusedError("Nothing is scheduled for this post.");
      // Never live: back to a draft, as an unpublish would.
      return write("schedule.cancel", id, changeId, expectedVersion, async () => ({
        fields: { status: "draft", publishAt: null, publishedAt: null, scheduleChangeId: null },
      }));
    },

    // Waiting updates, and posts Carrel scheduled whose time has come and that the hooks have not heard yet.
    async due({ now, limit }) {
      const firsts = await db
        .select({ slug: posts.slug, publishAt: posts.publishAt, changeId: posts.scheduleChangeId })
        .from(posts)
        .where(and(eq(posts.status, "published"), isNotNull(posts.scheduleChangeId), lte(posts.publishAt, now.toISOString())))
        .limit(limit);
      const due: DueSchedule[] = [
        ...(await updates.due(now, limit)),
        ...firsts.map((p) => ({ id: p.slug, kind: "publish" as const, publishAt: utc(p.publishAt!), changeId: p.changeId! })),
      ];
      return due.sort((a, b) => a.publishAt.localeCompare(b.publishAt)).slice(0, limit);
    },

    async apply(id, { kind, publishAt, changeId, now }) {
      if (new Date(publishAt) > now) return null;
      const current = await findPost(id);
      if (kind === "publish") {
        // Already live by the clock: clearing the change id is what takes it out of `due`.
        if (!current || current.status !== "published" || current.scheduleChangeId !== changeId || !current.publishAt) return null;
        if (utc(current.publishAt) !== utc(publishAt)) return null;
        await updatePost(env, current.id, { scheduleChangeId: null });
        const version = await versionOf(current, await waiting(id));
        recordChange("schedule.publish", id, version, changeId);
        return { id, version, status: "published", changeId, scheduledUpdate: await waiting(id) };
      }
      const update = await updates.get(id);
      if (!update || update.publishAt !== utc(publishAt) || update.changeId !== changeId) return null;
      const match = { publishAt: update.publishAt, changeId };
      // Deleted, renamed or taken down since: the update has nothing left to replace.
      if (!current || statusOf(current) !== "published") {
        await updates.remove(id, match).run();
        return null;
      }
      const { fields, people: links } = await changeFromSource(update.source, current.kind);
      await snapshotVersion(env, current, "schedule.apply");
      await updatePost(env, current.id, fields);
      if (links) await setEpisodePeople(env, current.id, links);
      await updates.remove(id, match).run();
      const version = await versionOf((await findPost(id))!, null);
      recordChange("schedule.apply", id, version, changeId);
      return { id, version, status: "published", changeId, scheduledUpdate: null };
    },
  };

  return {
    site: { id: "germomics", name: "Germomics", origin: SITE_ORIGIN },
    content,
    schedules,
    // The Prelum render every stored body was made with (render.server.ts keeps the constant, checked against Prelum's).
    renderVersion: RENDER_VERSION,

    // A source whose front matter cannot be read previews as its body alone; a save still refuses it.
    preview: {
      async render({ id, source }) {
        const { renderDocument } = options;
        if (!renderDocument) throw new Error("the document renderer is not on this request");
        const key = pageKeyOf(id ?? "");
        let path: string;
        let draft: Parameters<RenderDocument>[1];
        if (key) {
          path = PAGE_HREF[key];
          if (!path || TEXT_PAGES.has(key)) throw new RefusedError("That page has no preview.");
          const { title, body } = parsePageSource(source);
          const { html } = await rendered(() => renderMarkdown(body, libraryMedia(env)));
          draft = { page: { key, title, html } };
        } else {
          const post = await draftPost(id, source);
          path = `/${post.slug}`;
          draft = { post };
        }
        const response = await renderDocument(new Request(new URL(path, SITE_ORIGIN), { headers: { Accept: "text/html" } }), draft);
        if (!response.ok) throw new RefusedError(`The preview did not render: ${path} answered ${response.status}.`);
        // A page's own robots tag indexes it; the strictest tag wins, so this one keeps a preview out of every index.
        return (await response.text()).replace(/<head\b[^>]*>/i, (head) => `${head}<meta name="robots" content="noindex, nofollow">`);
      },
    },

    media: carrelMedia(env, recordChange),
    // The 404s workers/app.ts counts, for Carrel's report.
    insight: { notFound: (query) => notFoundReport(env.DB, query) },
  };
}
