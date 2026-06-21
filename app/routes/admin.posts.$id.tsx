import { useState } from "react";
import { Form, Link, redirect, useFetcher } from "react-router";
import { Upload, History, Trash2, ExternalLink } from "lucide-react";
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
} from "~/lib/admin.server";
import { uploadAudio } from "~/lib/r2.server";
import { formatDate, formatDuration } from "~/lib/format";
import type { Chapter, Guest, Post } from "~/db/schema";

// ── action helpers ──────────────────────────────────────────────────────────
function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}
function numOrNull(v: FormDataEntryValue | null): number | null {
  const n = Number(v);
  return Number.isFinite(n) && String(v ?? "").trim() !== "" ? Math.floor(n) : null;
}
function parseJson<T>(v: FormDataEntryValue | null, fallback: T): { value: T } | { error: string } {
  const s = String(v ?? "").trim();
  if (!s) return { value: fallback };
  try {
    return { value: JSON.parse(s) as T };
  } catch {
    return { error: "invalid JSON" };
  }
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const post = await getPostById(env, Number(params.id));
  if (!post) throw new Response("Not found", { status: 404 });
  return { post, versions: await listVersions(env, post.id) };
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

  if (intent === "audio") {
    const file = form.get("audio");
    if (!(file instanceof File) || file.size === 0) return { ok: false as const, error: "No audio file." };
    const duration = numOrNull(form.get("duration")); // detected client-side
    const safe = file.name.replace(/[^\w.-]/g, "_");
    const key = `episodes/${id}/${Date.now()}-${safe}`;
    const { url, size } = await uploadAudio(env, key, await file.arrayBuffer(), file.type || "audio/mpeg");
    await updatePost(env, id, {
      audioUrl: url, // media.germomics.com (never the worker origin)
      audioByteSize: size, // server-trusted from the stored object
      audioDuration: duration,
      audioMimeType: file.type || "audio/mpeg",
    });
    return { ok: true as const, message: `Audio uploaded (${formatDuration(duration)}).` };
  }

  if (intent === "restore") {
    await restoreVersion(env, id, Number(form.get("versionId")));
    return { ok: true as const, message: "Version restored." };
  }

  // save / publish / unpublish — snapshot the current row first (version history)
  await snapshotVersion(env, post);

  const chapters = parseJson<Chapter[]>(form.get("chapters"), []);
  if ("error" in chapters) return { ok: false as const, error: `Chapters: ${chapters.error}` };
  const guests = parseJson<Guest[]>(form.get("guests"), []);
  if ("error" in guests) return { ok: false as const, error: `Guests: ${guests.error}` };

  const fields: Partial<Post> = {
    title: String(form.get("title") ?? post.title).trim() || "Untitled",
    slug: String(form.get("slug") ?? post.slug).trim(),
    excerpt: emptyToNull(form.get("excerpt")),
    body: String(form.get("body") ?? ""),
    coverImage: emptyToNull(form.get("coverImage")),
    seoTitle: emptyToNull(form.get("seoTitle")),
    seoDescription: emptyToNull(form.get("seoDescription")),
    tags: String(form.get("tags") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    featured: form.get("featured") === "on",
  };

  if (post.kind === "episode") {
    const et = form.get("episodeType");
    Object.assign(fields, {
      episodeNumber: numOrNull(form.get("episodeNumber")),
      seasonNumber: numOrNull(form.get("seasonNumber")),
      episodeType: et === "trailer" || et === "bonus" ? et : "full",
      explicit: form.get("explicit") === "on",
      transcript: emptyToNull(form.get("transcript")),
      chapters: chapters.value,
      guests: guests.value,
      episodeArtwork: emptyToNull(form.get("episodeArtwork")),
    } satisfies Partial<Post>);
  }

  if (intent === "publish") {
    fields.status = "published";
    fields.guid = post.guid ?? generateGuid(); // generated once, then immutable
    fields.publishedAt = post.publishedAt ?? new Date().toISOString();
  } else if (intent === "unpublish") {
    fields.status = "draft";
  }

  await updatePost(env, id, fields);
  return {
    ok: true as const,
    message: intent === "publish" ? "Published." : intent === "unpublish" ? "Unpublished." : "Saved.",
  };
}

// ── audio sub-form (client-side duration detection) ─────────────────────────
function AudioUploader({ current, duration }: { current: string | null; duration: number | null }) {
  const fetcher = useFetcher<typeof action>();
  const [detected, setDetected] = useState<number | null>(null);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      setDetected(Math.floor(audio.duration));
      URL.revokeObjectURL(audio.src);
    };
    audio.src = URL.createObjectURL(file);
  };

  return (
    <fetcher.Form method="post" encType="multipart/form-data" className="space-y-2 rounded-lg border border-border bg-surface p-4">
      <input type="hidden" name="intent" value="audio" />
      <input type="hidden" name="duration" value={detected ?? ""} />
      <label className="block font-display text-sm font-medium">Audio (MP3 → R2)</label>
      {current ? (
        <p className="font-mono text-xs text-muted">
          current: {current} · {formatDuration(duration)}
        </p>
      ) : (
        <p className="font-mono text-xs text-muted">no audio yet</p>
      )}
      <input type="file" name="audio" accept="audio/*" onChange={onFile} className="block text-sm" />
      {detected != null ? (
        <p className="font-mono text-xs text-accent">detected duration {formatDuration(detected)} — byte size measured on upload</p>
      ) : null}
      <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 font-display text-sm text-white hover:bg-brand-strong">
        <Upload size={14} aria-hidden /> Upload
      </button>
      {fetcher.data?.ok ? <span className="ml-2 text-xs text-accent">{fetcher.data.message}</span> : null}
    </fetcher.Form>
  );
}

const FIELD = "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus-visible:border-accent";
const LABEL = "block font-display text-sm font-medium mb-1";

export default function Editor({ loaderData, actionData }: Route.ComponentProps) {
  const { post, versions } = loaderData;
  const isEpisode = post.kind === "episode";
  const restore = useFetcher();

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
      <div>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-semibold">
            Edit {post.kind}{" "}
            <span className={post.status === "published" ? "text-accent" : "text-brand"}>· {post.status}</span>
          </h1>
          {post.status === "published" ? (
            <Link to={`/${post.slug}`} className="inline-flex items-center gap-1 font-mono text-xs text-accent hover:underline">
              <ExternalLink size={13} aria-hidden /> view
            </Link>
          ) : (
            <span className="font-mono text-xs text-muted">draft preview at /{post.slug}</span>
          )}
        </div>

        {actionData?.ok ? <p className="mt-3 rounded bg-surface px-3 py-2 text-sm text-accent">{actionData.message}</p> : null}
        {actionData && actionData.ok === false ? (
          <p className="mt-3 rounded bg-surface px-3 py-2 text-sm text-brand">{actionData.error}</p>
        ) : null}

        <Form method="post" className="mt-4 space-y-4">
          <div>
            <label className={LABEL} htmlFor="title">Title</label>
            <input id="title" name="title" defaultValue={post.title} className={FIELD} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="slug">Slug</label>
              <input id="slug" name="slug" defaultValue={post.slug} className={FIELD} />
            </div>
            <div>
              <label className={LABEL} htmlFor="tags">Tags (comma-separated)</label>
              <input id="tags" name="tags" defaultValue={(post.tags ?? []).join(", ")} className={FIELD} />
            </div>
          </div>
          <div>
            <label className={LABEL} htmlFor="excerpt">Excerpt</label>
            <textarea id="excerpt" name="excerpt" defaultValue={post.excerpt ?? ""} rows={2} className={FIELD} />
          </div>
          <div>
            <label className={LABEL} htmlFor="body">Body (HTML)</label>
            <textarea id="body" name="body" defaultValue={post.body} rows={12} className={`${FIELD} font-mono`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL} htmlFor="coverImage">Cover image URL</label>
              <input id="coverImage" name="coverImage" defaultValue={post.coverImage ?? ""} className={FIELD} />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" name="featured" defaultChecked={post.featured} /> Featured
            </label>
          </div>

          {isEpisode ? (
            <fieldset className="space-y-4 rounded-lg border border-border p-4">
              <legend className="px-1 font-display text-sm font-medium text-brand">Episode</legend>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={LABEL} htmlFor="episodeNumber">Number</label>
                  <input id="episodeNumber" name="episodeNumber" type="number" defaultValue={post.episodeNumber ?? ""} className={FIELD} />
                </div>
                <div>
                  <label className={LABEL} htmlFor="seasonNumber">Season</label>
                  <input id="seasonNumber" name="seasonNumber" type="number" defaultValue={post.seasonNumber ?? ""} className={FIELD} />
                </div>
                <div>
                  <label className={LABEL} htmlFor="episodeType">Type</label>
                  <select id="episodeType" name="episodeType" defaultValue={post.episodeType ?? "full"} className={FIELD}>
                    <option value="full">full</option>
                    <option value="trailer">trailer</option>
                    <option value="bonus">bonus</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="explicit" defaultChecked={post.explicit ?? false} /> Explicit
                </label>
                <span className="font-mono text-xs text-muted">
                  GUID (locked): {post.guid ?? "— generated on publish"}
                </span>
              </div>
              <div>
                <label className={LABEL} htmlFor="episodeArtwork">Episode artwork URL</label>
                <input id="episodeArtwork" name="episodeArtwork" defaultValue={post.episodeArtwork ?? ""} className={FIELD} />
              </div>
              <div>
                <label className={LABEL} htmlFor="transcript">Transcript (lines like “[01:23] text” become clickable)</label>
                <textarea id="transcript" name="transcript" defaultValue={post.transcript ?? ""} rows={6} className={`${FIELD} font-mono`} />
              </div>
              <div>
                <label className={LABEL} htmlFor="chapters">Chapters JSON — [{`{ "start": 0, "title": "Intro" }`}]</label>
                <textarea id="chapters" name="chapters" defaultValue={JSON.stringify(post.chapters ?? [], null, 2)} rows={5} className={`${FIELD} font-mono`} />
              </div>
              <div>
                <label className={LABEL} htmlFor="guests">Guests JSON — [{`{ "name": "…", "role": "…", "bio": "…" }`}]</label>
                <textarea id="guests" name="guests" defaultValue={JSON.stringify(post.guests ?? [], null, 2)} rows={4} className={`${FIELD} font-mono`} />
              </div>
            </fieldset>
          ) : null}

          <details className="rounded-lg border border-border p-4">
            <summary className="cursor-pointer font-display text-sm font-medium">SEO</summary>
            <div className="mt-3 space-y-3">
              <input name="seoTitle" placeholder="SEO title" defaultValue={post.seoTitle ?? ""} className={FIELD} />
              <textarea name="seoDescription" placeholder="SEO description" defaultValue={post.seoDescription ?? ""} rows={2} className={FIELD} />
            </div>
          </details>

          <div className="flex flex-wrap gap-2">
            <button name="intent" value="save" className="rounded-lg bg-brand px-4 py-2 font-display text-sm font-medium text-white hover:bg-brand-strong">
              Save draft
            </button>
            {post.status === "published" ? (
              <button name="intent" value="unpublish" className="rounded-lg border border-border px-4 py-2 font-display text-sm hover:border-brand">
                Unpublish
              </button>
            ) : (
              <button name="intent" value="publish" className="rounded-lg bg-accent px-4 py-2 font-display text-sm font-medium text-bg hover:brightness-110">
                Publish
              </button>
            )}
          </div>
        </Form>

        <Form
          method="post"
          className="mt-4"
          onSubmit={(e) => {
            if (!confirm("Delete this post permanently?")) e.preventDefault();
          }}
        >
          <button name="intent" value="delete" className="inline-flex items-center gap-1.5 font-mono text-xs text-muted hover:text-brand">
            <Trash2 size={13} aria-hidden /> delete
          </button>
        </Form>
      </div>

      <aside className="space-y-6">
        {isEpisode ? <AudioUploader current={post.audioUrl} duration={post.audioDuration} /> : null}

        <div className="rounded-lg border border-border p-4">
          <h2 className="mb-2 flex items-center gap-1.5 font-display text-sm font-semibold">
            <History size={15} aria-hidden /> Versions
          </h2>
          <ul className="space-y-1">
            {versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-muted">{formatDate(String(v.createdAt))}</span>
                <restore.Form method="post">
                  <input type="hidden" name="intent" value="restore" />
                  <input type="hidden" name="versionId" value={v.id} />
                  <button className="font-mono text-[11px] text-accent hover:underline">restore</button>
                </restore.Form>
              </li>
            ))}
            {versions.length === 0 ? <li className="font-mono text-[11px] text-muted">none yet</li> : null}
          </ul>
        </div>
      </aside>
    </div>
  );
}
