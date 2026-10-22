// The kind-aware post editor route — loader + action behind the admin gate; renders <PostEditor>.
// All field writes go through Drizzle (admin.server / people.server); body HTML is sanitized on
// every save; scheduling rides on publish_at (publish-on-read gate). guid stays immutable.
import { redirect } from "react-router";
import type { Route } from "./+types/admin.posts.$id";
import { getEnv } from "~/lib/context.server";
import { getPostById } from "~/lib/posts.server";
import {
  updatePost,
  deletePost,
  snapshotVersion,
  listVersions,
  restoreVersion,
  generateGuid,
  isSlugAvailable,
  listAllPosts,
} from "~/lib/admin.server";
import { listPeople, getEpisodePeople, setEpisodePeople } from "~/lib/people.server";
import { sanitizeHtml } from "~/lib/sanitize.server";
import { readingTime } from "~/lib/seo";
import { previewToken } from "~/lib/preview.server";
import { aiConfigured } from "~/lib/ai.server";
import { PostEditor, type EditorData } from "~/components/admin/PostEditor";
import type { Post, Chapter, Guest, KeyMoment, Source } from "~/db/schema";

const orNull = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return s ? s : null;
};
const numOrNull = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && String(v ?? "").trim() !== "" ? Math.floor(n) : null;
};

export async function loader({ params, context, request }: Route.LoaderArgs) {
  const env = getEnv(context);
  const post = await getPostById(env, Number(params.id));
  if (!post) throw new Response("Not found", { status: 404 });

  const [versions, people, links, all] = await Promise.all([
    listVersions(env, post.id),
    listPeople(env),
    getEpisodePeople(env, post.id),
    listAllPosts(env),
  ]);
  const origin = new URL(request.url).origin;
  const token = await previewToken(env, post.id);

  const data: EditorData = {
    post,
    versions: versions.map((v) => ({ id: v.id, createdAt: String(v.createdAt) })),
    people: people.map((p) => ({ id: p.id, name: p.name, slug: p.slug, role: p.role })),
    selectedPeople: links.map((l) => ({ personId: l.person.id, role: l.role ?? "" })),
    takenSlugs: all.filter((p) => p.id !== post.id).map((p) => p.slug),
    origin,
    previewUrl: token ? `${origin}/preview/${post.id}/${token}` : null,
    aiAvailable: aiConfigured(env),
  };
  return data;
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const env = getEnv(context);
  const id = Number(params.id);
  const post = await getPostById(env, id);
  if (!post) throw new Response("Not found", { status: 404 });
  const form = await request.formData();
  const intent = String(form.get("intent"));

  if (intent === "delete") {
    await deletePost(env, id);
    throw redirect("/admin/posts");
  }

  if (intent === "restore") {
    await snapshotVersion(env, post);
    await restoreVersion(env, id, Number(form.get("versionId")));
    return { ok: true as const, message: "Version restored." };
  }

  // Parse the editor payload (save / autosave / publish / unpublish / schedule).
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(String(form.get("payload") ?? "{}"));
  } catch {
    return { ok: false as const, error: "Bad payload." };
  }

  const slug = orNull(payload.slug) ?? post.slug;
  if (!(await isSlugAvailable(env, slug, id))) {
    return { ok: false as const, error: "Slug already taken." };
  }

  const isEpisode = post.kind === "episode";
  const sanitizedBody = await sanitizeHtml(String(payload.body ?? ""));

  const fields: Partial<Post> = {
    title: String(payload.title ?? "").trim() || "Untitled",
    slug,
    excerpt: orNull(payload.excerpt),
    body: sanitizedBody,
    readingTime: readingTime(sanitizedBody),
    tags: Array.isArray(payload.tags) ? (payload.tags as string[]) : [],
    sources: Array.isArray(payload.sources) ? (payload.sources as Source[]) : [],
    featured: !!payload.featured,
    coverImage: orNull(payload.coverImage),
    coverAlt: orNull(payload.coverAlt),
    ogImage: orNull(payload.ogImage),
    ogImageAlt: orNull(payload.ogImageAlt),
    seoTitle: orNull(payload.seoTitle),
    seoDescription: orNull(payload.seoDescription),
  };

  if (isEpisode) {
    const et = payload.episodeType;
    Object.assign(fields, {
      episodeNumber: numOrNull(payload.episodeNumber),
      seasonNumber: numOrNull(payload.seasonNumber),
      episodeType: et === "trailer" || et === "bonus" ? et : "full",
      explicit: !!payload.explicit,
      audioUrl: orNull(payload.audioUrl),
      audioDuration: numOrNull(payload.audioDuration),
      audioByteSize: numOrNull(payload.audioByteSize),
      audioMimeType: orNull(payload.audioMimeType) ?? "audio/mpeg",
      audioPeaks: Array.isArray(payload.audioPeaks) ? (payload.audioPeaks as number[]) : null,
      episodeArtwork: orNull(payload.episodeArtwork),
      episodeArtworkAlt: orNull(payload.episodeArtworkAlt),
      transcript: orNull(payload.transcript),
      chapters: Array.isArray(payload.chapters) ? (payload.chapters as Chapter[]) : [],
      keyMoments: Array.isArray(payload.keyMoments) ? (payload.keyMoments as KeyMoment[]) : [],
      guests: Array.isArray(payload.guests) ? (payload.guests as Guest[]) : [],
    } satisfies Partial<Post>);
  }

  // Status transitions.
  let message = "Saved.";
  if (intent === "publish") {
    fields.status = "published";
    fields.guid = post.guid ?? generateGuid();
    fields.publishedAt = post.publishedAt ?? new Date().toISOString();
    fields.publishAt = null;
    message = "Published.";
  } else if (intent === "schedule") {
    const at = orNull(form.get("publishAt"));
    if (!at) return { ok: false as const, error: "Pick a schedule time." };
    fields.status = "published";
    fields.guid = post.guid ?? generateGuid();
    fields.publishAt = at;
    fields.publishedAt = at;
    message = "Scheduled.";
  } else if (intent === "unpublish") {
    fields.status = "draft";
    fields.publishAt = null;
    message = "Moved to draft.";
  }

  // Snapshot a version on explicit saves (not on autosave).
  if (intent !== "autosave") await snapshotVersion(env, post);

  await updatePost(env, id, fields);

  if (isEpisode) {
    const people = Array.isArray(payload.people) ? (payload.people as { personId: number; role?: string }[]) : [];
    await setEpisodePeople(
      env,
      id,
      people
        .filter((p) => Number.isFinite(p.personId))
        .map((p, i) => ({ personId: Number(p.personId), role: p.role ?? null, sort: i })),
    );
  }

  return { ok: true as const, message };
}

export default function EditPost({ loaderData }: Route.ComponentProps) {
  return <PostEditor data={loaderData} />;
}
