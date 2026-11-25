import { getDb } from "~/db/index.server";
import { and, eq, getTableColumns } from "drizzle-orm";
import { inList } from "@dustinedwards/site-runtime/d1";
import { logEvent } from "@dustinedwards/site-runtime/log";
import {
  NotFoundError,
  RefusedError,
  VersionConflictError,
  type WriteResult,
} from "@dustinedwards/site-api";
import { d1ScheduledUpdates } from "@dustinedwards/site-api/schedules";
import {
  contentBlocks,
  contentBlockVersions,
  episodePeople,
  people,
  posts,
  type Post,
} from "~/db/schema";
import { CHANGE_AUTHOR, generateGuid, nextUpdatedAt, snapshotVersion } from "~/lib/admin.server";
import { setEpisodePeople } from "~/lib/people.server";
import { lcpAboveBody, pageFields, postBodyFields } from "~/lib/render.server";
import { getShowConfig } from "~/lib/show.server";
import { findPage, PAGE_ID, pageVersion, type PageRow } from "./pages.server";
import {
  parsePageSource,
  parseSource,
  SourceError,
  type ParsedSource,
  type PersonRef,
} from "./source";
import {
  type RenderDocument,
  ID_PATTERN,
  type Item,
  type Actor,
  type Waiting,
  type Change,
  nowIso,
  statusOf,
  versionOf,
  waitingOf,
  rendered,
  EPISODE_NEEDS,
  IN_TRASH,
} from "./adapter-support.server";

export function createWrites(
  env: Env,
  log: (entry: Record<string, unknown>) => void = (entry) => logEvent(String(entry.event), entry),
  options: { renderDocument?: RenderDocument } = {},
) {
  const db = getDb(env);
  const showAuthor = async () => (await getShowConfig(env)).author;
  const updates = d1ScheduledUpdates(env.DB);
  const waiting = async (slug: string): Promise<Waiting> => waitingOf(await updates.get(slug));

  // posts has no column for Carrel's changeId, so it goes to the Worker log with the id and new version.
  const recordChange = (event: string, id: string, version: string, changeId: string) =>
    log({ event: `carrel.${event}`, id, version, changeId });

  async function peopleOf(ids: number[]): Promise<Map<number, PersonRef[]>> {
    const out = new Map<number, PersonRef[]>();
    if (!ids.length) return out;
    const rows = await db
      .select({
        postId: episodePeople.postId,
        slug: people.slug,
        role: episodePeople.role,
      })
      .from(episodePeople)
      .innerJoin(people, eq(people.id, episodePeople.personId))
      .where(inList(episodePeople.postId, ids))
      .orderBy(episodePeople.sort);
    for (const r of rows)
      out.set(r.postId, [...(out.get(r.postId) ?? []), { slug: r.slug, role: r.role }]);
    return out;
  }

  const withPeople = async (rows: Post[]): Promise<Item[]> => {
    const byPost = await peopleOf(rows.filter((p) => p.kind === "episode").map((p) => p.id));
    return rows.map((p) => (p.kind === "episode" ? { ...p, people: byPost.get(p.id) ?? [] } : p));
  };

  /** Writes only while the row is the one whose version was checked: every write moves updated_at, so of two saves from one version only the first wins. False when another got there first. */
  async function writeUnchanged(current: Item, fields: Partial<Post>): Promise<boolean> {
    const written = await db
      .update(posts)
      .set({ ...fields, updatedAt: nextUpdatedAt })
      .where(and(eq(posts.id, current.id), eq(posts.updatedAt, current.updatedAt)))
      .returning({ id: posts.id });
    return written.length > 0;
  }

  async function findPost(slug: string): Promise<Item | null> {
    const rows = await db.select().from(posts).where(eq(posts.slug, slug)).limit(1);
    return rows[0] ? (await withPeople(rows))[0] : null;
  }

  async function changeFromSource(source: string, kind: Post["kind"]): Promise<Change> {
    let parsed;
    try {
      parsed = parseSource(source, kind);
    } catch (err) {
      throw new RefusedError(
        err instanceof SourceError ? err.message : "The source could not be read.",
      );
    }
    const fields: Partial<Post> = {
      ...(await rendered(() =>
        postBodyFields(
          env,
          parsed.body,
          lcpAboveBody({ kind, coverImage: parsed.post?.coverImage }),
        ),
      )),
      ...parsed.post,
    };
    if (!parsed.episode) return { fields };
    const { people: refs = [], ...episode } = parsed.episode;
    Object.assign(fields, episode);
    const slugs = refs.map((r) => r.slug);
    const found = slugs.length
      ? await db
          .select({ id: people.id, slug: people.slug })
          .from(people)
          .where(inList(people.slug, slugs))
      : [];
    const ids = new Map(found.map((p) => [p.slug, p.id]));
    const unknown = slugs.filter((s) => !ids.has(s));
    if (unknown.length)
      throw new RefusedError(
        `No one in the germomics People list (/admin/people) has the slug ${unknown.join(", ")}.`,
      );
    return {
      fields,
      people: refs.map((r, sort) => ({
        personId: ids.get(r.slug)!,
        role: r.role,
        sort,
      })),
    };
  }

  // `dropUpdate`: a publish, unpublish or trash drops a waiting update, so the cron never revives it.
  async function write(
    event: string,
    slug: string,
    changeId: string,
    expectedVersion: string | null,
    build: (current: Item | null) => Promise<Change>,
    { dropUpdate = false, actor }: { dropUpdate?: boolean; actor?: Actor } = {},
  ): Promise<WriteResult> {
    const current = await findPost(slug);
    const update = current ? await waiting(slug) : null;
    const version = current ? await versionOf(current, update) : null;
    if (version !== expectedVersion) throw new VersionConflictError(version);
    if (!current && (!ID_PATTERN.test(slug) || PAGE_ID.test(slug)))
      throw new RefusedError("That id cannot be used as a slug.");
    const { fields, people: links } = await build(current);
    let id: number;
    if (current) {
      if (!(await writeUnchanged(current, fields))) {
        const now = await findPost(slug);
        throw new VersionConflictError(now ? await versionOf(now, await waiting(slug)) : null);
      }
      await snapshotVersion(env, current, event, actor?.name);
      id = current.id;
    } else {
      const created = await db
        .insert(posts)
        .values({
          kind: "article",
          title: "Untitled",
          slug,
          status: "draft",
          ...fields,
        })
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
    return {
      id: finalSlug,
      version: next,
      status: statusOf(row),
      changeId,
      scheduledUpdate: left,
    };
  }

  async function goingLive(current: Item | null, source: string | undefined): Promise<Change> {
    if (!current) throw new NotFoundError();
    if (current.trashedAt) throw new RefusedError(IN_TRASH);
    if (current.kind === "episode" && (!current.audioUrl || !current.transcript?.trim()))
      throw new RefusedError(EPISODE_NEEDS);
    const change =
      source !== undefined ? await changeFromSource(source, current.kind) : { fields: {} };
    return {
      ...change,
      fields: {
        ...change.fields,
        status: "published",
        guid: current.guid ?? generateGuid(),
      },
    };
  }

  async function writePage(
    event: string,
    id: string,
    changeId: string,
    expectedVersion: string | null,
    build: (current: PageRow) => Promise<Partial<PageRow>>,
    actor?: Actor,
  ): Promise<WriteResult> {
    const current = await findPage(env, id);
    const now = current ? await pageVersion(current) : null;
    if (now !== expectedVersion) throw new VersionConflictError(now);
    if (!current)
      throw new RefusedError(
        "A germomics page is a route of its own, so Carrel edits the pages it lists and adds none.",
      );
    const fields = await build(current);
    const written = await db
      .update(contentBlocks)
      .set({ ...fields, updatedAt: nowIso() })
      .where(
        and(eq(contentBlocks.key, current.key), eq(contentBlocks.updatedAt, current.updatedAt)),
      )
      .returning({ key: contentBlocks.key });
    if (!written.length) {
      const latest = await findPage(env, id);
      throw new VersionConflictError(latest && (await pageVersion(latest)));
    }
    await db.insert(contentBlockVersions).values({
      blockKey: current.key,
      snapshot: current,
      event,
      author: actor?.name ?? CHANGE_AUTHOR,
    });
    const next = { ...current, ...fields };
    const version = await pageVersion(next);
    recordChange(event, id, version, changeId);
    return {
      id,
      version,
      status: next.status === "published" ? "published" : "draft",
      changeId,
    };
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
    Promise.reject(
      new RefusedError(
        `Every germomics page is a live route, so it cannot be ${what}. Publish a new version instead.`,
      ),
    );

  async function existingPost(id: string, what: string): Promise<Item> {
    if (await findPage(env, id))
      throw new RefusedError(`Every germomics page is a live route, so it cannot be ${what}.`);
    const current = await findPost(id);
    if (!current) throw new NotFoundError();
    return current;
  }

  /** The post a source would make, never written; noindex either way. */
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
    const blank = Object.fromEntries(
      Object.keys(getTableColumns(posts)).map((column) => [column, null]),
    );
    const base =
      current ??
      ({
        ...blank,
        id: 0,
        kind,
        title: "Untitled",
        body: "",
        status: "draft",
        tags: [],
        featured: false,
        createdAt: now,
        updatedAt: now,
      } as unknown as Post);
    return {
      ...base,
      ...parsed.post,
      ...episode,
      ...(await rendered(() =>
        postBodyFields(
          env,
          parsed.body,
          lcpAboveBody({ kind, coverImage: parsed.post?.coverImage }),
        ),
      )),
      slug: current?.slug ?? (id && ID_PATTERN.test(id) ? id : "preview"),
      noindex: true,
    };
  }

  return {
    env,
    db,
    options,
    changeFromSource,
    draftPost,
    existingPost,
    findPost,
    goingLive,
    pageSourceFields,
    peopleOf,
    recordChange,
    refusedForPage,
    showAuthor,
    updates,
    waiting,
    withPeople,
    write,
    writePage,
    writeUnchanged,
  };
}

export type Writes = ReturnType<typeof createWrites>;
