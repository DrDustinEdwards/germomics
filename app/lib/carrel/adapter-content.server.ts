import { and, eq, isNull, ne, sql } from "drizzle-orm";
import {
  NotFoundError,
  transcriptVersion,
  RefusedError,
  VersionConflictError,
  type ContentAdapter,
} from "@dustinedwards/site-api";
import { SEARCH_FIELDS } from "@dustinedwards/site-api/frontmatter";
import { utc } from "@dustinedwards/site-api/schedules";
import { postRedirects, posts, postVersions } from "~/db/schema";
import { deletePost, snapshotVersion } from "~/lib/admin.server";
import { pageFields } from "~/lib/render.server";
import { SITE_ORIGIN } from "~/lib/site";
import {
  findPage,
  iso,
  pageHistory,
  pageKeyOf,
  PAGE_ID,
  pageSummary,
  pageVersion,
  type PageRow,
} from "./pages.server";
import { renderPageSource } from "./source";
import {
  ID_PATTERN,
  type Item,
  nowIso,
  everLive,
  sourceOf,
  versionOf,
  summaryOf,
  rendered,
  IN_TRASH,
  CHANGE_NAMES,
  historyOf,
  postChange,
} from "./adapter-support.server";
import { listContent } from "./adapter-list.server";
import type { Writes } from "./adapter-writes.server";

export function createContent({
  db,
  env,
  changeFromSource,
  existingPost,
  findPost,
  goingLive,
  pageSourceFields,
  recordChange,
  refusedForPage,
  showAuthor,
  updates,
  waiting,
  withPeople,
  write,
  writePage,
  writeUnchanged,
}: Writes): ContentAdapter {
  const content: ContentAdapter = {
    // Field-to-column mapping is in ./source.ts.
    postFields: ["excerpt", "authors", "series", "seriesPart", "featureImage", "featureImageAlt"],
    searchFields: SEARCH_FIELDS,
    // A page has no tags, authors or publish date, so those filters leave pages out.
    filters: ["kind", "tag", "author", "published"],
    publishedAtSettable: true,

    list: (query) => listContent({ db, env, showAuthor, withPeople, waiting }, query),

    async get(id) {
      const b = await findPage(env, id);
      if (b)
        return {
          ...(await pageSummary(b)),
          format: "markdown" as const,
          source: renderPageSource(b),
          version: await pageVersion(b),
        };
      const p = await findPost(id);
      if (!p) return null;
      const update = await waiting(id);
      return {
        ...(await summaryOf(p, await showAuthor(), update)),
        format: "markdown" as const,
        source: sourceOf(p),
        version: await versionOf(p, update),
        ...(p.kind === "episode" && p.transcript?.trim() ? { transcript: p.transcript } : {}),
      };
    },

    // An episode starts in the admin, with its audio, so a new id is always an article.
    saveDraft: (id, input) =>
      pageKeyOf(id)
        ? writePage(
            "save",
            id,
            input.changeId,
            input.expectedVersion,
            () => pageSourceFields(input.source),
            input.actor,
          )
        : write(
            "save",
            id,
            input.changeId,
            input.expectedVersion,
            async (current) => {
              const change = await changeFromSource(input.source, current?.kind ?? "article");
              return current
                ? change
                : { ...change, fields: { ...change.fields, status: "draft" } };
            },
            { actor: input.actor },
          ),

    // The guid is made once here and never rewritten. The date is Carrel's, else when the post first went live, else now.
    publish: (id, input) =>
      pageKeyOf(id)
        ? writePage(
            "publish",
            id,
            input.changeId,
            input.expectedVersion,
            async (current) => {
              if (input.publishedAt)
                throw new RefusedError("A germomics page has no publish date.");
              return {
                ...(input.source !== undefined ? await pageSourceFields(input.source) : {}),
                ...(current.renderVersion === null
                  ? await rendered(() => pageFields(env, current.value))
                  : {}),
                status: "published",
              };
            },
            input.actor,
          )
        : write(
            "publish",
            id,
            input.changeId,
            input.expectedVersion,
            async (current) => {
              const change = await goingLive(current, input.source);
              const was = current && everLive(current) ? current.publishedAt : null;
              const publishedAt = input.publishedAt
                ? new Date(input.publishedAt).toISOString()
                : (was ?? nowIso());
              return {
                ...change,
                fields: {
                  ...change.fields,
                  publishedAt,
                  publishAt: null,
                  scheduleChangeId: null,
                },
              };
            },
            { dropUpdate: true, actor: input.actor },
          ),

    schedule: (id, input) =>
      pageKeyOf(id)
        ? writePage(
            "schedule",
            id,
            input.changeId,
            input.expectedVersion,
            refusedForPage("scheduled"),
            input.actor,
          )
        : write(
            "schedule",
            id,
            input.changeId,
            input.expectedVersion,
            async (current) => {
              const change = await goingLive(current, input.source);
              const at = utc(input.publishAt);
              return {
                ...change,
                fields: {
                  ...change.fields,
                  publishAt: at,
                  publishedAt: at,
                  scheduleChangeId: input.changeId,
                },
              };
            },
            { actor: input.actor },
          ),

    unpublish: (id, input) =>
      pageKeyOf(id)
        ? writePage(
            "unpublish",
            id,
            input.changeId,
            input.expectedVersion,
            refusedForPage("taken down"),
            input.actor,
          )
        : write(
            "unpublish",
            id,
            input.changeId,
            input.expectedVersion,
            async (current) => {
              if (!current) throw new NotFoundError();
              return {
                fields: {
                  status: "draft",
                  publishAt: null,
                  scheduleChangeId: null,
                },
              };
            },
            { dropUpdate: true, actor: input.actor },
          ),

    async setTags(id, { tags, expectedVersion, changeId, actor }) {
      if (await findPage(env, id)) throw new RefusedError("A germomics page has no tags.");
      const current = await existingPost(id, "tagged");
      if (current.trashedAt) throw new RefusedError(IN_TRASH);
      return write(
        "tags",
        id,
        changeId,
        expectedVersion,
        async () => ({
          fields: { tags },
        }),
        { actor },
      );
    },

    // The row stays, so history, people and guid follow the slug. The old address of a post ever live redirects; a taken slug or page id is refused.
    async rename(id, { newId, expectedVersion, changeId, actor }) {
      const current = await existingPost(id, "renamed");
      if (current.trashedAt) throw new RefusedError(IN_TRASH);
      if (!ID_PATTERN.test(newId) || PAGE_ID.test(newId))
        throw new RefusedError("That id cannot be used as a slug.");
      const version = await versionOf(current, await waiting(id));
      if (version !== expectedVersion) throw new VersionConflictError(version);
      if (newId !== id && (await findPost(newId)))
        throw new RefusedError(`Another post already has the slug ${newId}.`);
      const result = await write(
        "rename",
        id,
        changeId,
        expectedVersion,
        async () => ({
          fields: { slug: newId },
        }),
        { actor },
      );
      await env.DB.prepare("UPDATE scheduled_updates SET content_id = ? WHERE content_id = ?")
        .bind(newId, id)
        .run();
      // The new slug is a post's again, so it stops redirecting.
      await db.delete(postRedirects).where(eq(postRedirects.fromSlug, newId));
      const previousPath = everLive(current) ? `/${id}` : null;
      if (previousPath) {
        await db
          .insert(postRedirects)
          .values({ fromSlug: id, postId: current.id })
          .onConflictDoUpdate({
            target: postRedirects.fromSlug,
            set: { postId: current.id },
          });
      }
      return {
        ...result,
        scheduledUpdate: (await waiting(newId)) ?? null,
        previousPath,
      };
    },

    async trash(id, { expectedVersion, changeId, actor }) {
      const current = await existingPost(id, "trashed");
      if (current.trashedAt) throw new RefusedError("This post is already in the trash.");
      return write(
        "trash",
        id,
        changeId,
        expectedVersion,
        async () => ({
          fields: {
            trashedAt: nowIso(),
            status: "draft",
            publishAt: null,
            scheduleChangeId: null,
          },
        }),
        { dropUpdate: true, actor },
      );
    },

    // A restore never republishes.
    async restore(id, { expectedVersion, changeId, actor }) {
      const current = await existingPost(id, "restored");
      if (!current.trashedAt) throw new RefusedError("This post is not in the trash.");
      return write(
        "restore",
        id,
        changeId,
        expectedVersion,
        async () => ({
          fields: { trashedAt: null, status: "draft" },
        }),
        { actor },
      );
    },

    // Live at once; checked against the transcript's own version and written only while the row is the one checked.
    async setTranscript(id, { transcript, expectedTranscriptVersion, changeId, actor }) {
      if (await findPage(env, id)) throw new RefusedError("A page has no transcript.");
      const current = await findPost(id);
      if (!current) throw new NotFoundError();
      if (current.kind !== "episode") throw new RefusedError("Only an episode has a transcript.");
      const held = current.transcript?.trim() ? await transcriptVersion(current.transcript) : null;
      if (held !== expectedTranscriptVersion) throw new VersionConflictError(held);
      if (!(await writeUnchanged(current, { transcript }))) {
        const now = await findPost(id);
        throw new VersionConflictError(
          now?.transcript?.trim() ? await transcriptVersion(now.transcript) : null,
        );
      }
      await snapshotVersion(env, current, "transcript", actor?.name);
      const version = await versionOf(current, await waiting(id));
      recordChange("transcript", id, version, changeId);
      return { version };
    },

    // Only from the trash; cascades to snapshots, people and redirects.
    async delete(id, { expectedVersion, changeId }) {
      const current = await existingPost(id, "deleted");
      const version = await versionOf(current, await waiting(id));
      if (version !== expectedVersion) throw new VersionConflictError(version);
      if (!current.trashedAt)
        throw new RefusedError(
          "Move this post to the trash first; the trash is deleted after 30 days.",
        );
      await updates.remove(id).run();
      await deletePost(env, current.id);
      recordChange("delete", id, version, changeId);
    },

    // Posts linking here, so a trash or delete warns first. instr finds candidates (a LIKE would fail on D1 past its
    // 50-byte pattern limit, so a long slug could not be trashed); the pattern keeps /slug-two from counting as /slug.
    async backlinks(id) {
      if (!ID_PATTERN.test(id) || !(await findPost(id))) return [];
      const dots = (text: string) => text.replace(/[.]/g, "\\.");
      const linked = new RegExp(
        `(?:\\]\\(|href=")(?:${dots(SITE_ORIGIN)})?/${dots(id)}(?=[/?#)"\\s]|$)`,
      );
      const rows = await db
        .select({ slug: posts.slug, title: posts.title, body: posts.body })
        .from(posts)
        .where(
          and(
            ne(posts.slug, id),
            isNull(posts.trashedAt),
            sql`instr(${posts.body}, ${`/${id}`}) > 0`,
          ),
        )
        .orderBy(posts.slug);
      return rows
        .filter((r) => linked.test(r.body))
        .map((r) => ({ id: r.slug, title: r.title, path: `/${r.slug}` }));
    },

    async revisions(id) {
      const b = await findPage(env, id);
      if (b) {
        const current = { state: b, version: await pageVersion(b), at: iso(b.updatedAt) };
        return historyOf(
          await pageHistory(env, b.key),
          current,
          pageVersion,
          (event) => CHANGE_NAMES[event ?? ""] ?? "Saved",
        );
      }
      const p = await findPost(id);
      if (!p) return null;
      const rows = await db
        .select()
        .from(postVersions)
        .where(eq(postVersions.postId, p.id))
        .orderBy(postVersions.id);
      const current = {
        state: p,
        version: await versionOf(p, await waiting(id)),
        at: iso(p.updatedAt),
      };
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

  return content;
}
