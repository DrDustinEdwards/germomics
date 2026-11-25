// The site's side of Carrel's contract (@dustinedwards/site-api v0.36.0): an adapter over the writing in D1 (articles,
// episodes and the Markdown pages) and the images in the BLOG_IMAGES bucket (the media group is ./media.server.ts).
// Carrel is the only editor of the site's writing; the admin keeps everything that is not writing.
//
// SCOPE.
//   Articles and episodes: every field a writer sets (./source.ts), from a first draft to publish, schedule, unpublish,
//     rename, trash, restore and delete. An episode is created in the germomics admin with its audio, and its audio and
//     first transcript are uploaded there (files measured or converted in the browser); Carrel puts it live once it has
//     both, and fixes the transcript's words afterward (TRANSCRIPTS, below). A save
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
// TRANSCRIPTS. Carrel replaces an episode's transcript through setTranscript (site-api v0.36.0), checked against the
//   transcript's own version; the post's version, which never includes the transcript, stays as it was.
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
import { and, eq, isNotNull, lte } from "drizzle-orm";
import { logEvent } from "@dustinedwards/site-runtime/log";
import {
  NotFoundError,
  RefusedError,
  VersionConflictError,
  type DueSchedule,
  type SchedulesAdapter,
  type SiteAdapter,
} from "@dustinedwards/site-api";
import { utc } from "@dustinedwards/site-api/schedules";
import { notFoundReport } from "@dustinedwards/site-runtime/not-found";
import { posts } from "~/db/schema";
import { snapshotVersion, updatePost } from "~/lib/admin.server";
import { TEXT_PAGES } from "~/lib/content.server";
import { setEpisodePeople } from "~/lib/people.server";
import { libraryMedia, renderMarkdown, RENDER_VERSION } from "~/lib/render.server";
import { PAGE_HREF, SITE_ORIGIN } from "~/lib/site";
import { carrelMedia } from "./media.server";
import { pageKeyOf } from "./pages.server";
import { parsePageSource } from "./source";
import { type RenderDocument, statusOf, versionOf, rendered } from "./adapter-support.server";
import { createContent } from "./adapter-content.server";
import { createWrites } from "./adapter-writes.server";

export type { RenderDocument } from "./adapter-support.server";

export function createCarrelAdapter(
  env: Env,
  log: (entry: Record<string, unknown>) => void = (entry) => logEvent(String(entry.event), entry),
  options: { renderDocument?: RenderDocument } = {},
): SiteAdapter {
  const writes = createWrites(env, log, options);
  const content = createContent(writes);
  const { db, changeFromSource, draftPost, findPost, recordChange, updates, waiting, write } =
    writes;

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
      if (statusOf(current) !== "published")
        throw new RefusedError("Only a live post takes a scheduled update.");
      await changeFromSource(source, current.kind); // refused now, not at the time, when it cannot be read or rendered
      await updates.put(id, { source, publishAt, changeId }).run();
      const update = { publishAt: utc(publishAt), changeId };
      const next = await versionOf(current, update);
      recordChange("schedule.update", id, next, changeId);
      return {
        id,
        version: next,
        status: "published",
        changeId,
        scheduledUpdate: update,
      };
    },

    async cancel(id, { expectedVersion, changeId, actor }) {
      const current = await findPost(id);
      if (!current) throw new NotFoundError();
      const update = await waiting(id);
      const version = await versionOf(current, update);
      if (version !== expectedVersion) throw new VersionConflictError(version);
      if (update) {
        await updates.remove(id).run();
        const next = await versionOf(current, null);
        recordChange("schedule.cancel", id, next, changeId);
        return {
          id,
          version: next,
          status: statusOf(current),
          changeId,
          scheduledUpdate: null,
        };
      }
      if (statusOf(current) !== "scheduled")
        throw new RefusedError("Nothing is scheduled for this post.");
      // Never live: back to a draft, as an unpublish would.
      return write(
        "schedule.cancel",
        id,
        changeId,
        expectedVersion,
        async () => ({
          fields: {
            status: "draft",
            publishAt: null,
            publishedAt: null,
            scheduleChangeId: null,
          },
        }),
        { actor },
      );
    },

    // Waiting updates, and posts Carrel scheduled whose time has come and that the hooks have not heard yet.
    async due({ now, limit }) {
      const firsts = await db
        .select({
          slug: posts.slug,
          publishAt: posts.publishAt,
          changeId: posts.scheduleChangeId,
        })
        .from(posts)
        .where(
          and(
            eq(posts.status, "published"),
            isNotNull(posts.scheduleChangeId),
            lte(posts.publishAt, now.toISOString()),
          ),
        )
        .limit(limit);
      const due: DueSchedule[] = [
        ...(await updates.due(now, limit)),
        ...firsts.map((p) => ({
          id: p.slug,
          kind: "publish" as const,
          publishAt: utc(p.publishAt!),
          changeId: p.changeId!,
        })),
      ];
      return due.sort((a, b) => a.publishAt.localeCompare(b.publishAt)).slice(0, limit);
    },

    async apply(id, { kind, publishAt, changeId, now }) {
      if (new Date(publishAt) > now) return null;
      const current = await findPost(id);
      if (kind === "publish") {
        // Already live by the clock: clearing the change id is what takes it out of `due`.
        if (
          !current ||
          current.status !== "published" ||
          current.scheduleChangeId !== changeId ||
          !current.publishAt
        )
          return null;
        if (utc(current.publishAt) !== utc(publishAt)) return null;
        await updatePost(env, current.id, { scheduleChangeId: null });
        const version = await versionOf(current, await waiting(id));
        recordChange("schedule.publish", id, version, changeId);
        return {
          id,
          version,
          status: "published",
          changeId,
          scheduledUpdate: await waiting(id),
        };
      }
      const update = await updates.get(id);
      if (!update || update.publishAt !== utc(publishAt) || update.changeId !== changeId)
        return null;
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
      return {
        id,
        version,
        status: "published",
        changeId,
        scheduledUpdate: null,
      };
    },
  };

  return {
    site: { id: "germomics", name: "Germomics", origin: SITE_ORIGIN },
    content,
    schedules,
    // The Prelum render every stored body was made with (render.server.ts keeps the constant, checked against Prelum's).
    renderVersion: RENDER_VERSION,

    // The draft through the site's own route and layout, in-process (workers/app.ts), so it has the header, footer and
    // byline; a source whose front matter cannot be read previews as its body alone (a save still refuses it).
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
          const { html } = await rendered(() => renderMarkdown(body, libraryMedia(env), { env }));
          draft = { page: { key, title, html } };
        } else {
          const post = await draftPost(id, source);
          path = `/${post.slug}`;
          draft = { post };
        }
        const response = await renderDocument(
          new Request(new URL(path, SITE_ORIGIN), { headers: { Accept: "text/html" } }),
          draft,
        );
        if (!response.ok)
          throw new RefusedError(
            `The preview did not render: ${path} answered ${response.status}.`,
          );
        // A page's own robots tag indexes it; the strictest tag wins, so this one keeps a preview out of every index.
        return (await response.text()).replace(
          /<head\b[^>]*>/i,
          (head) => `${head}<meta name="robots" content="noindex, nofollow">`,
        );
      },
    },

    media: carrelMedia(env, recordChange),
    // The 404s workers/app.ts counts, for Carrel's report.
    insight: { notFound: (query) => notFoundReport(env.DB, query) },
  };
}
