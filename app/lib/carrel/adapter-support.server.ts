import type { PagePreview } from "~/lib/preview-context";
import {
  contentVersion,
  RefusedError,
  type ContentSummary,
  type Revision,
  type ScheduledUpdate,
} from "@dustinedwards/site-api";
import type { Post } from "~/db/schema";
import { CHANGE_AUTHOR } from "~/lib/admin.server";
import { iso } from "./pages.server";
import { renderSource, type PersonRef } from "./source";

/** The site's own render of a route (workers/app.ts) with the draft on its context; never stored. */
export type RenderDocument = (
  request: Request,
  draft: { post: Post } | { page: PagePreview },
) => Promise<Response>;

export const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
export type Status = ContentSummary["status"];
export type Item = Post & { people?: PersonRef[] };

export type Actor = { name: string };
export type Waiting = Pick<ScheduledUpdate, "publishAt" | "changeId"> | null;
export type Change = {
  fields: Partial<Post>;
  people?: { personId: number; role: string | null; sort: number }[];
};

export const nowIso = () => new Date().toISOString();

export function statusOf(p: Pick<Post, "status" | "publishAt">): Status {
  if (p.status !== "published") return "draft";
  return p.publishAt && p.publishAt > nowIso() ? "scheduled" : "published";
}

export const everLive = (p: Post) => !!p.publishedAt && p.publishedAt <= nowIso();

export const creditOf = (p: Pick<Post, "authors">, show: string): string[] =>
  p.authors?.length ? p.authors : [show];

export const sourceOf = (p: Item) =>
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
    guests: p.guests ?? [],
    people: p.people ?? [],
  });

/** The trash and a waiting update join the hash only when present, so a post with neither hashes source, status, schedule and slug. */
export const versionOf = (p: Item, update: Waiting = null): Promise<string> =>
  contentVersion([
    sourceOf(p),
    p.status,
    p.publishAt ?? null,
    p.slug,
    ...(p.trashedAt ? ["trashed", p.trashedAt] : []),
    ...(update ? [update.publishAt, update.changeId] : []),
  ]);

export const waitingOf = (u: ScheduledUpdate | null): Waiting =>
  u ? { publishAt: u.publishAt, changeId: u.changeId } : null;

export async function summaryOf(
  p: Item,
  show: string,
  update: Waiting = null,
): Promise<ContentSummary> {
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

export async function rendered<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    throw new RefusedError(err instanceof Error ? err.message : "The body could not be rendered.");
  }
}

export const EPISODE_NEEDS =
  "An episode goes live with its audio and transcript, which are added in the germomics admin (/admin/episodes).";
export const IN_TRASH = "This post is in the trash. Restore it first.";

export const CHANGE_NAMES: Record<string, string> = {
  save: "Saved",
  publish: "Published",
  schedule: "Scheduled",
  unpublish: "Taken off the site",
  tags: "Tags set",
  trash: "Moved to the trash",
  restore: "Restored from the trash",
  "schedule.apply": "Scheduled update put live",
  "schedule.cancel": "Schedule canceled",
  audio: "Audio saved in the admin",
  transcript: "Transcript saved",
};

export type Kept = {
  snapshot: unknown;
  event: string | null;
  author: string | null;
  createdAt: string;
};

export async function historyOf<T>(
  rows: Kept[],
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
  if (!rows.length)
    await add(
      { at: current.at ?? epoch, author: CHANGE_AUTHOR, message: "Current" },
      current.state,
      current.version,
    );
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    await add(
      {
        at: iso(r.createdAt) ?? epoch,
        author: r.author ?? CHANGE_AUTHOR,
        message: nameOf(r.event, states[i]),
      },
      states[i + 1],
      i === rows.length - 1 ? current.version : undefined,
    );
  }
  if (rows.length) {
    const oldest = states[0] as { updatedAt?: string | null };
    await add(
      {
        at: iso(oldest.updatedAt) ?? iso(rows[0].createdAt) ?? epoch,
        author: CHANGE_AUTHOR,
        message: "Earliest version kept",
      },
      states[0],
    );
  }
  return entries;
}

export const postChange = (event: string | null, before: Item) =>
  event === "rename" ? `Renamed from ${before.slug}` : (CHANGE_NAMES[event ?? ""] ?? "Saved");
