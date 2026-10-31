// The site's side of Carrel's contract (@dustinedwards/site-api): an adapter over the writing in D1 (articles,
// episodes' text and the Markdown pages) and the images in the BLOG_IMAGES bucket (the media group is
// ./media.server.ts). Carrel is where the site's writing is written; the admin keeps everything that is not writing.
//
// SCOPE.
//   Articles: everything a source can say, from a first draft to publish, schedule and unpublish.
//   Episodes: the text only (title, excerpt, tags, cover, SEO and the body). Audio, chapters, people, peaks and the
//     transcript stay in the germomics admin, which also creates an episode and puts it live or takes it down, so
//     Carrel never creates one, never publishes one for the first time and never unpublishes one. A save to a live
//     episode changes the live page, as a save to a live article does.
//   Pages: the content_blocks pages written in Markdown (about, the bio, privacy, terms, contact, txasm), id
//     `page.<name>` for the block `page:<name>`. Each is a route, so Carrel saves and publishes one but cannot create,
//     schedule or take one down. llms.txt and ai.txt are plain text (TEXT_PAGES) and stay in the admin.
//
// RENDER. Every write renders the Markdown with Prelum (app/lib/render.server.ts) and stores the HTML beside it, with
// the reading time and the render version; a source Prelum refuses (a figure without alt text, say) is refused
// with its reason and nothing is written. A snapshot goes into post_versions before every edit of a post, and the
// guid is generated once at first publish and never rewritten, as the admin does.
//
// IDS AND VERSIONS. A post's id is its slug. A version is a hash of everything Carrel can see or change (the source,
// the status and the schedule, and an update waiting on a live post), so any change anywhere gives a new version and
// two saves in one second cannot collide.
//
// SCHEDULES. An article scheduled before it was ever live is a published row with a future publish_at: every public
// read hides it until then (publiclyVisible), so it needs no cron. An update scheduled on a LIVE post (site-api
// v0.10.0) waits in scheduled_updates while the live version stays served, and the one-minute cron (workers/app.ts,
// api.runSchedules) puts it live.
import { and, desc, eq, like, or } from "drizzle-orm";
import {
  contentVersion,
  NotFoundError,
  RefusedError,
  VersionConflictError,
  type ContentSummary,
  type ScheduledUpdate,
  type SiteAdapter,
  type WriteResult,
} from "@dustinedwards/site-api";
import { SEARCH_FIELDS } from "@dustinedwards/site-api/frontmatter";
import { d1ScheduledUpdates, utc } from "@dustinedwards/site-api/schedules";
import { getDb } from "~/db/index.server";
import { contentBlocks, posts, postVersions, type ContentBlock, type Post } from "~/db/schema";
import { generateGuid, snapshotVersion, updatePost } from "~/lib/admin.server";
import { TEXT_PAGES } from "~/lib/content.server";
import { libraryMedia, pageFields, postBodyFields, renderMarkdown } from "~/lib/render.server";
import { SITE_ORIGIN } from "~/lib/site";
import { PAGE_HREF } from "~/components/content/PageHits";
import { carrelMedia } from "./media.server";
import { parsePageSource, parseSource, renderPageSource, renderSource } from "./source";

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
// A page's id: content_blocks' `page:about` is Carrel's `page.about` (a colon is not an id character).
const PAGE_ID = /^page\.([a-z0-9-]+)$/;
const pageKeyOf = (id: string) => (PAGE_ID.test(id) ? `page:${PAGE_ID.exec(id)![1]}` : null);
const pageIdOf = (key: string) => key.replace(/^page:/, "page.");

type Status = ContentSummary["status"];

// SQLite's datetime('now') is "YYYY-MM-DD HH:MM:SS" in UTC; the contract wants ISO with an offset.
const iso = (v: string | null | undefined): string | null => {
  if (!v) return null;
  const withT = v.includes("T") ? v : `${v.replace(" ", "T")}Z`;
  const d = new Date(withT);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

function statusOf(p: Pick<Post, "status" | "publishAt">): Status {
  if (p.status !== "published") return "draft";
  return p.publishAt && p.publishAt > new Date().toISOString() ? "scheduled" : "published";
}

type Waiting = Pick<ScheduledUpdate, "publishAt" | "changeId"> | null;

/**
 * The version of a row as Carrel sees it. The waiting update's time and change id join the parts
 * only when there is one, so every version made before scheduled updates existed is unchanged.
 */
const versionOf = (p: Post, update: Waiting = null): Promise<string> =>
  contentVersion([renderSource(p), p.status, p.publishAt ?? null, ...(update ? [update.publishAt, update.changeId] : [])]);

const waitingOf = (u: ScheduledUpdate | null): Waiting => (u ? { publishAt: u.publishAt, changeId: u.changeId } : null);

function summaryOf(p: Post, update: Waiting = null): ContentSummary {
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
  };
}

async function findPost(env: Env, slug: string): Promise<Post | null> {
  const rows = await getDb(env).select().from(posts).where(eq(posts.slug, slug)).limit(1);
  return rows[0] ?? null;
}

/** Every write checks the version first, in one place. */
async function requireVersion(post: Post | null, update: Waiting, expected: string | null): Promise<void> {
  const current = post ? await versionOf(post, update) : null;
  if (current !== expected) throw new VersionConflictError(current);
}

/** A render refused by Prelum, as Carrel shows it: the reason, with the line and the fix. */
async function rendered<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    throw new RefusedError(err instanceof Error ? err.message : "The body could not be rendered.");
  }
}

/** The save rules applied to a Carrel source: the body rendered with its reading time, and only the fields it names. */
async function fieldsFromSource(env: Env, source: string): Promise<Partial<Post>> {
  let parsed;
  try {
    parsed = parseSource(source);
  } catch (err) {
    throw new RefusedError(err instanceof Error ? err.message : "The source could not be read.");
  }
  const fields: Partial<Post> = await rendered(() => postBodyFields(env, parsed.body));
  if (parsed.title !== null) fields.title = parsed.title.trim() || "Untitled";
  if (parsed.excerpt !== null) fields.excerpt = parsed.excerpt;
  if (parsed.tags !== null) fields.tags = parsed.tags;
  if (parsed.coverImage !== null) fields.coverImage = parsed.coverImage;
  if (parsed.coverAlt !== null) fields.coverAlt = parsed.coverAlt;
  // The search fields under site-api's names, onto the posts columns; a blank one is null, the site's default.
  if (parsed.searchTitle !== null) fields.seoTitle = parsed.searchTitle || null;
  if (parsed.description !== null) fields.seoDescription = parsed.description || null;
  if (parsed.image !== null) fields.ogImage = parsed.image || null;
  if (parsed.imageAlt !== null) fields.ogImageAlt = parsed.imageAlt || null;
  if (parsed.canonical !== null) fields.canonical = parsed.canonical || null;
  if (parsed.noindex !== null) fields.noindex = parsed.noindex;
  return fields;
}

const EPISODE_LIVE = "An episode goes live, with its audio, from the germomics admin. Carrel edits its text.";

// ---------- pages ----------

type PageRow = ContentBlock;
const pageVersion = (b: PageRow) => contentVersion([renderPageSource(b), b.status]);

function pageSummary(b: PageRow): ContentSummary {
  return {
    id: pageIdOf(b.key),
    kind: "page",
    title: b.title || b.key,
    status: b.status === "published" ? "published" : "draft",
    path: b.status === "published" ? (PAGE_HREF[b.key] ?? null) : null,
    publishAt: null,
    publishedAt: null,
    updatedAt: iso(b.updatedAt),
  };
}

async function findPage(env: Env, id: string): Promise<PageRow | null> {
  const key = pageKeyOf(id);
  if (!key || TEXT_PAGES.has(key)) return null;
  const rows = await getDb(env).select().from(contentBlocks).where(and(eq(contentBlocks.key, key), eq(contentBlocks.kind, "page"))).limit(1);
  return rows[0] ?? null;
}

async function listPages(env: Env): Promise<PageRow[]> {
  const rows = await getDb(env).select().from(contentBlocks).where(eq(contentBlocks.kind, "page"));
  return rows.filter((b) => !TEXT_PAGES.has(b.key));
}

export function createCarrelAdapter(env: Env, log: (entry: Record<string, unknown>) => void = console.log): SiteAdapter {
  const db = getDb(env);
  const updates = d1ScheduledUpdates(env.DB);
  const waiting = async (slug: string): Promise<Waiting> => waitingOf(await updates.get(slug));

  // Carrel's changeId joins its authorship record to this site's history. posts has no column for
  // it, so it is written to the Worker log with the id and the new version, and returned to Carrel.
  const recordChange = (event: string, id: string, version: string, changeId: string) =>
    log({ event: `carrel.${event}`, id, version, changeId });

  // `dropUpdate`: a publish or an unpublish drops an update waiting on the post, so the cron
  // never brings back what was just published over or taken down.
  async function write(
    event: string,
    slug: string,
    changeId: string,
    expectedVersion: string | null,
    build: (current: Post | null) => Promise<Partial<Post>>,
    { dropUpdate = false } = {},
  ): Promise<WriteResult> {
    const current = await findPost(env, slug);
    const update = current ? await waiting(slug) : null;
    await requireVersion(current, update, expectedVersion);
    if (!current && (!ID_PATTERN.test(slug) || PAGE_ID.test(slug))) throw new RefusedError("That id cannot be used as a slug.");
    const fields = await build(current);
    let row: Post;
    if (current) {
      await snapshotVersion(env, current);
      await updatePost(env, current.id, fields);
      row = { ...current, ...fields };
    } else {
      const created = await db
        .insert(posts)
        .values({ kind: "article", title: "Untitled", slug, status: "draft", ...fields })
        .returning();
      row = created[0];
    }
    if (update && dropUpdate) await updates.remove(slug).run();
    const left = dropUpdate ? null : update;
    const version = await versionOf((await findPost(env, slug)) ?? row, left);
    recordChange(event, slug, version, changeId);
    return { id: slug, version, status: statusOf(row), changeId, scheduledUpdate: left };
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
    await db.update(contentBlocks).set({ ...fields, updatedAt: new Date().toISOString() }).where(eq(contentBlocks.key, current.key));
    const next = { ...current, ...fields };
    const version = await pageVersion(next);
    recordChange(event, id, version, changeId);
    return { id, version, status: pageSummary(next).status, changeId };
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

  return {
    site: { id: "germomics", name: "Germomics", origin: SITE_ORIGIN },

    content: {
      searchFields: SEARCH_FIELDS,

      async list({ status, q, cursor, limit }) {
        const rows = await db
          .select()
          .from(posts)
          .where(q ? or(like(posts.title, `%${q}%`), like(posts.slug, `%${q}%`)) : undefined)
          .orderBy(desc(posts.updatedAt), desc(posts.id));
        const needle = q?.toLowerCase();
        const pages = (await listPages(env)).filter((b) => !needle || (b.title ?? "").toLowerCase().includes(needle) || b.key.includes(needle));
        const items = [
          ...rows.filter((p) => ID_PATTERN.test(p.slug)).map((p) => ({ post: p, summary: summaryOf(p) })),
          ...pages.map((b) => ({ post: null, summary: pageSummary(b) })),
        ].filter((i) => !status || i.summary.status === status);
        const start = Math.max(0, Number(cursor) || 0);
        const page = items.slice(start, start + limit);
        const next = start + limit < items.length ? String(start + limit) : null;
        const out = await Promise.all(page.map(async (i) => (i.post ? summaryOf(i.post, await waiting(i.post.slug)) : i.summary)));
        return { items: out, nextCursor: next };
      },

      async get(id) {
        const b = await findPage(env, id);
        if (b) return { ...pageSummary(b), format: "markdown" as const, source: renderPageSource(b), version: await pageVersion(b) };
        const p = await findPost(env, id);
        if (!p) return null;
        const update = await waiting(id);
        return { ...summaryOf(p, update), format: "markdown" as const, source: renderSource(p), version: await versionOf(p, update) };
      },

      saveDraft: (id, input) =>
        pageKeyOf(id)
          ? writePage("save", id, input.changeId, input.expectedVersion, () => pageSourceFields(input.source))
          : write("save", id, input.changeId, input.expectedVersion, (current) =>
              fieldsFromSource(env, input.source).then((f) => ({ ...f, ...(current ? {} : { status: "draft" as const }) })),
            ),

      // A first publish of an article from Carrel's key is allowed (Carrel design decision 2). The guid is made
      // once here and never rewritten, exactly as the admin does. An episode is published from the admin.
      publish: (id, input) =>
        pageKeyOf(id)
          ? writePage("publish", id, input.changeId, input.expectedVersion, async (current) => ({
              ...(input.source !== undefined ? await pageSourceFields(input.source) : {}),
              ...(current.renderVersion === null ? await rendered(() => pageFields(env, current.value)) : {}),
              status: "published",
            }))
          : write("publish", id, input.changeId, input.expectedVersion, async (current) => {
              if (!current) throw new NotFoundError();
              if (current.kind === "episode" && statusOf(current) !== "published") throw new RefusedError(EPISODE_LIVE);
              return {
                ...(input.source !== undefined ? await fieldsFromSource(env, input.source) : {}),
                status: "published",
                guid: current.guid ?? generateGuid(),
                publishedAt: current.publishedAt ?? new Date().toISOString(),
                publishAt: null,
              };
            }, { dropUpdate: true }),

      schedule: (id, input) =>
        pageKeyOf(id)
          ? writePage("schedule", id, input.changeId, input.expectedVersion, refusedForPage("scheduled"))
          : write("schedule", id, input.changeId, input.expectedVersion, async (current) => {
              if (!current) throw new NotFoundError();
              if (current.kind === "episode") throw new RefusedError(EPISODE_LIVE);
              return {
                ...(input.source !== undefined ? await fieldsFromSource(env, input.source) : {}),
                status: "published",
                guid: current.guid ?? generateGuid(),
                publishAt: input.publishAt,
                publishedAt: input.publishAt,
              };
            }),

      unpublish: (id, input) =>
        pageKeyOf(id)
          ? writePage("unpublish", id, input.changeId, input.expectedVersion, refusedForPage("taken down"))
          : write("unpublish", id, input.changeId, input.expectedVersion, async (current) => {
              if (!current) throw new NotFoundError();
              if (current.kind === "episode") throw new RefusedError("An episode is taken down in the germomics admin, which keeps the podcast feed in step.");
              return { status: "draft", publishAt: null };
            }, { dropUpdate: true }),

      async revisions(id) {
        const b = await findPage(env, id);
        // A page keeps no history of its own; its one revision is the current text.
        if (b) return [{ version: await pageVersion(b), at: iso(b.updatedAt) ?? new Date(0).toISOString(), author: "germomics", message: "Current" }];
        const p = await findPost(env, id);
        if (!p) return null;
        const rows = await db
          .select()
          .from(postVersions)
          .where(eq(postVersions.postId, p.id))
          .orderBy(desc(postVersions.createdAt), desc(postVersions.id))
          .limit(50);
        const items = [];
        for (const r of rows) {
          const snap = r.snapshot as Post;
          items.push({
            version: await versionOf(snap),
            at: iso(r.createdAt) ?? new Date(0).toISOString(),
            author: "germomics",
            message: `Saved before an edit (${snap.title})`,
          });
        }
        return items;
      },

      async revisionSource(id, version) {
        const b = await findPage(env, id);
        if (b) return (await pageVersion(b)) === version ? renderPageSource(b) : null;
        const p = await findPost(env, id);
        if (!p) return null;
        if ((await versionOf(p, await waiting(id))) === version) return renderSource(p);
        const rows = await db.select().from(postVersions).where(eq(postVersions.postId, p.id)).limit(50);
        for (const r of rows) {
          const snap = r.snapshot as Post;
          if ((await versionOf(snap)) === version) return renderSource(snap);
        }
        return null;
      },
    },

    // Updates scheduled on live posts (site-api v0.10.0), kept in scheduled_updates.
    schedules: {
      async get(id) {
        return (await findPost(env, id)) ? updates.get(id) : null;
      },

      async update(id, { source, publishAt, expectedVersion, changeId }) {
        const current = await findPost(env, id);
        if (!current) throw new NotFoundError();
        const before = await waiting(id);
        await requireVersion(current, before, expectedVersion);
        if (statusOf(current) !== "published") throw new RefusedError("Only a live post takes a scheduled update.");
        await fieldsFromSource(env, source); // refused now, not at the time, when it cannot be read or rendered
        await updates.put(id, { source, publishAt, changeId }).run();
        const update = { publishAt: utc(publishAt), changeId };
        const version = await versionOf(current, update);
        recordChange("schedule.update", id, version, changeId);
        return { id, version, status: "published", changeId, scheduledUpdate: update };
      },

      async cancel(id, { expectedVersion, changeId }) {
        const current = await findPost(env, id);
        if (!current) throw new NotFoundError();
        const update = await waiting(id);
        await requireVersion(current, update, expectedVersion);
        if (update) {
          await updates.remove(id).run();
          const version = await versionOf(current, null);
          recordChange("schedule.cancel", id, version, changeId);
          return { id, version, status: statusOf(current), changeId, scheduledUpdate: null };
        }
        if (statusOf(current) !== "scheduled") throw new RefusedError("Nothing is scheduled for this post.");
        // Never live: back to a draft, as an unpublish would.
        return write("schedule.cancel", id, changeId, expectedVersion, async () => ({ status: "draft", publishAt: null }));
      },

      // Only waiting updates: a never-live scheduled article goes live by its publish_at on every read.
      due: ({ now, limit }) => updates.due(now, limit),

      async apply(id, { kind, publishAt, changeId, now }) {
        if (kind !== "update" || new Date(publishAt) > now) return null;
        const update = await updates.get(id);
        if (!update || update.publishAt !== utc(publishAt) || update.changeId !== changeId) return null;
        const match = { publishAt: update.publishAt, changeId };
        const current = await findPost(env, id);
        // Deleted, renamed or taken down in the admin since: the update has nothing left to replace.
        if (!current || statusOf(current) !== "published") {
          await updates.remove(id, match).run();
          return null;
        }
        const fields = await fieldsFromSource(env, update.source);
        await snapshotVersion(env, current);
        await updatePost(env, current.id, fields);
        await updates.remove(id, match).run();
        const row = (await findPost(env, id)) ?? { ...current, ...fields };
        const version = await versionOf(row, null);
        recordChange("schedule.apply", id, version, changeId);
        return { id, version, status: "published", changeId, scheduledUpdate: null };
      },
    },

    // The body as the site renders it (the same Prelum render and media library), in a plain page around it,
    // because an unsaved source has no row for the route to load.
    preview: {
      async render({ id, source }) {
        const page = pageKeyOf(id ?? "");
        const parsed = page ? parsePageSource(source) : parseSource(source);
        const { html } = await rendered(() => renderMarkdown(parsed.body, libraryMedia(env)));
        const title = (parsed.title ?? "Untitled").replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
        return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head><body><article><h1>${title}</h1>${html}</article></body></html>`;
      },
    },

    media: carrelMedia(env, recordChange),
  };
}
