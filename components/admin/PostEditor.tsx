'use client';

import { useState } from 'react';
import { UploadCloud } from 'lucide-react';
import type { Post } from '@/db/schema';
import { savePost } from '@/app/admin/actions';
import { hms, bytes, slugify } from '@/lib/format';

type AudioState = { url: string; size: number | null; duration: number | null };

export default function PostEditor({ post, kind }: { post?: Post; kind: 'episode' | 'article' }) {
  const isEpisode = kind === 'episode';
  const [slug, setSlug] = useState(post?.slug ?? '');
  const [audio, setAudio] = useState<AudioState>({
    url: post?.audioUrl ?? '',
    size: post?.audioByteSize ?? null,
    duration: post?.audioDuration ?? null,
  });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAudio(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      // Read duration client-side (no audio decoder on the Worker).
      const objectUrl = URL.createObjectURL(file);
      const probe = new Audio();
      probe.src = objectUrl;
      const duration = await new Promise<number>((resolve) => {
        probe.addEventListener('loadedmetadata', () => resolve(Math.round(probe.duration || 0)));
        probe.addEventListener('error', () => resolve(0));
      });
      URL.revokeObjectURL(objectUrl);

      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const data = (await res.json()) as { url: string; size: number };
      setAudio({ url: data.url, size: data.size, duration });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <form action={savePost} className="mx-auto max-w-2xl space-y-6 py-12">
      <input type="hidden" name="id" defaultValue={post?.id ?? ''} />
      <input type="hidden" name="kind" value={kind} />
      {post?.guid ? <input type="hidden" name="guid" defaultValue={post.guid} /> : null}

      <Field label="Title">
        <input
          name="title"
          required
          defaultValue={post?.title ?? ''}
          onChange={(e) => {
            if (!post && !slug) setSlug(slugify(e.target.value));
          }}
          className={input}
        />
      </Field>

      <Field label="Slug" hint="Permanent. Used in the URL and feed link.">
        <input name="slug" required value={slug} onChange={(e) => setSlug(e.target.value)} className={input} />
      </Field>

      <Field label="Excerpt">
        <textarea name="excerpt" rows={2} defaultValue={post?.excerpt ?? ''} className={input} />
      </Field>

      <Field label="Body (HTML)">
        <textarea name="body" rows={12} defaultValue={post?.body ?? ''} className={`${input} font-mono text-sm`} />
      </Field>

      <Field label="Tags" hint="Comma separated.">
        <input name="tags" defaultValue={(post?.tags ?? []).join(', ')} className={input} />
      </Field>

      {isEpisode ? (
        <fieldset className="space-y-6 rounded-2xl border border-border p-5">
          <legend className="px-2 font-display text-sm uppercase tracking-wider text-text-secondary">
            Episode
          </legend>

          <div>
            <span className="mb-2 block font-display text-sm text-text-primary">Audio</span>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">
              <UploadCloud size={16} aria-hidden />
              {uploading ? 'Uploading…' : 'Upload MP3'}
              <input type="file" accept="audio/*" onChange={onAudio} className="sr-only" />
            </label>
            {audio.url ? (
              <p className="mt-2 font-mono text-xs text-text-tertiary">
                {audio.url}
                {audio.duration ? ` · ${hms(audio.duration)}` : ''}
                {audio.size ? ` · ${bytes(audio.size)}` : ''}
              </p>
            ) : null}
            {error ? <p className="mt-2 font-mono text-xs text-red-400">{error}</p> : null}
            <input type="hidden" name="audioUrl" value={audio.url} />
            <input type="hidden" name="audioByteSize" value={audio.size ?? ''} />
            <input type="hidden" name="audioDuration" value={audio.duration ?? ''} />
            <input type="hidden" name="audioMimeType" defaultValue={post?.audioMimeType ?? 'audio/mpeg'} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Episode #">
              <input name="episodeNumber" type="number" defaultValue={post?.episodeNumber ?? ''} className={input} />
            </Field>
            <Field label="Season #">
              <input name="seasonNumber" type="number" defaultValue={post?.seasonNumber ?? ''} className={input} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Type">
              <select name="episodeType" defaultValue={post?.episodeType ?? 'full'} className={input}>
                <option value="full">full</option>
                <option value="trailer">trailer</option>
                <option value="bonus">bonus</option>
              </select>
            </Field>
            <Field label="Artwork URL">
              <input name="episodeArtwork" defaultValue={post?.episodeArtwork ?? ''} className={input} />
            </Field>
          </div>

          <Field label="Transcript">
            <textarea name="transcript" rows={6} defaultValue={post?.transcript ?? ''} className={input} />
          </Field>

          <Field label="Chapters (JSON)" hint='[{"start":0,"title":"Intro"}]'>
            <textarea
              name="chapters"
              rows={4}
              defaultValue={post?.chapters ? JSON.stringify(post.chapters, null, 2) : ''}
              className={`${input} font-mono text-sm`}
            />
          </Field>

          <Field label="Guests (JSON)" hint='[{"name":"Jane Doe","role":"historian"}]'>
            <textarea
              name="guests"
              rows={4}
              defaultValue={post?.guests ? JSON.stringify(post.guests, null, 2) : ''}
              className={`${input} font-mono text-sm`}
            />
          </Field>

          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input type="checkbox" name="explicit" defaultChecked={post?.explicit ?? false} /> Explicit
          </label>

          {post?.guid ? (
            <p className="font-mono text-xs text-text-tertiary">GUID (locked): {post.guid}</p>
          ) : (
            <p className="font-mono text-xs text-text-tertiary">GUID is generated and locked on first save.</p>
          )}
        </fieldset>
      ) : null}

      <Field label="Cover image URL">
        <input name="coverImage" defaultValue={post?.coverImage ?? ''} className={input} />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="SEO title">
          <input name="seoTitle" defaultValue={post?.seoTitle ?? ''} className={input} />
        </Field>
        <Field label="SEO description">
          <input name="seoDescription" defaultValue={post?.seoDescription ?? ''} className={input} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Field label="Status">
          <select name="status" defaultValue={post?.status ?? 'draft'} className={input}>
            <option value="draft">draft</option>
            <option value="published">published</option>
          </select>
        </Field>
        <label className="mt-6 flex items-center gap-2 text-sm text-text-secondary">
          <input type="checkbox" name="featured" defaultChecked={post?.featured ?? false} /> Featured
        </label>
      </div>

      <button
        type="submit"
        disabled={uploading}
        className="rounded-full bg-brand px-6 py-3 font-display text-sm font-medium text-on-accent disabled:opacity-50"
      >
        Save
      </button>
    </form>
  );
}

const input =
  'w-full rounded-xl border border-border bg-card px-3 py-2 text-text-primary outline-none focus:border-brand';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-display text-sm text-text-primary">{label}</span>
      {children}
      {hint ? <span className="mt-1 block font-mono text-xs text-text-tertiary">{hint}</span> : null}
    </label>
  );
}
