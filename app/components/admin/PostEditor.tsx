// The ONE kind-aware editor (spec §A) used by both articles and episodes. Two-column layout:
// title + body on the left, sidebar cards on the right; episode-only cards render only when
// kind=episode. Sticky action bar shows save state. Autosaves (debounced) and guards unsaved
// navigation. State is serialized to a single JSON `payload` the route action parses.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useBlocker, useFetcher } from "react-router";
import {
  Save, UploadCloud, CalendarClock, Eye, Trash2, ExternalLink, Megaphone,
  Image as ImageIcon, Headphones, Search, History, FileText, RefreshCw, Check, Loader2, AlertCircle,
  BookText,
} from "lucide-react";
import type { Post } from "~/db/schema";
import type { Chapter, Guest, KeyMoment, Source } from "~/lib/types";
import { slugifyGuest } from "~/lib/posts";
import { Card, Field, Button, Badge, inputCx } from "./ui";
import { RichTextEditor } from "./RichTextEditor";
import { ImageField } from "./ImageField";
import { AudioField, type AudioState } from "./AudioField";
import { TranscriptField } from "./TranscriptField";
import { ChaptersEditor } from "./ChaptersEditor";
import { KeyMomentsEditor } from "./KeyMomentsEditor";
import { SourcesEditor } from "./SourcesEditor";
import { GuestsField, type PersonLite, type SelectedPerson } from "./GuestsField";
import { SeoPanel } from "./SeoPanel";
import { VersionHistory } from "./VersionHistory";
import { AiAssist } from "./AiAssist";
import { BodyRenderer } from "~/components/content/BodyRenderer";

export type EditorData = {
  post: Post;
  versions: { id: number; createdAt: string }[];
  people: PersonLite[];
  selectedPeople: SelectedPerson[];
  takenSlugs: string[];
  origin: string;
  previewUrl: string;
  aiAvailable: boolean;
};

type FormState = {
  title: string;
  slug: string;
  slugTouched: boolean;
  excerpt: string;
  body: string;
  tags: string;
  sources: Source[];
  featured: boolean;
  coverImage: string;
  coverAlt: string;
  ogImage: string;
  ogImageAlt: string;
  seoTitle: string;
  seoDescription: string;
  // episode
  episodeNumber: string;
  seasonNumber: string;
  episodeType: string;
  explicit: boolean;
  audio: AudioState;
  episodeArtwork: string;
  episodeArtworkAlt: string;
  transcript: string;
  chapters: Chapter[];
  keyMoments: KeyMoment[];
  guests: Guest[];
  people: SelectedPerson[];
};

function initialState(d: EditorData): FormState {
  const p = d.post;
  return {
    title: p.title ?? "",
    slug: p.slug ?? "",
    slugTouched: true,
    excerpt: p.excerpt ?? "",
    body: p.body ?? "",
    tags: (p.tags ?? []).join(", "),
    sources: p.sources ?? [],
    featured: !!p.featured,
    coverImage: p.coverImage ?? "",
    coverAlt: p.coverAlt ?? "",
    ogImage: p.ogImage ?? "",
    ogImageAlt: p.ogImageAlt ?? "",
    seoTitle: p.seoTitle ?? "",
    seoDescription: p.seoDescription ?? "",
    episodeNumber: p.episodeNumber != null ? String(p.episodeNumber) : "",
    seasonNumber: p.seasonNumber != null ? String(p.seasonNumber) : "",
    episodeType: p.episodeType ?? "full",
    explicit: !!p.explicit,
    audio: {
      audioUrl: p.audioUrl ?? "",
      audioDuration: p.audioDuration ?? null,
      audioByteSize: p.audioByteSize ?? null,
      audioMimeType: p.audioMimeType ?? "audio/mpeg",
      audioPeaks: p.audioPeaks ?? null,
    },
    episodeArtwork: p.episodeArtwork ?? "",
    episodeArtworkAlt: p.episodeArtworkAlt ?? "",
    transcript: p.transcript ?? "",
    chapters: p.chapters ?? [],
    keyMoments: p.keyMoments ?? [],
    guests: p.guests ?? [],
    people: d.selectedPeople,
  };
}

function autoSlug(title: string): string {
  return slugifyGuest(title);
}

export function PostEditor({ data }: { data: EditorData }) {
  const { post, origin, previewUrl } = data;
  const isEpisode = post.kind === "episode";
  const fetcher = useFetcher<{ ok: boolean; message?: string; error?: string }>();

  const [form, setForm] = useState<FormState>(() => initialState(data));
  const savedRef = useRef(JSON.stringify(form));
  const dirty = JSON.stringify(form) !== savedRef.current;

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  // Slug: auto from title until the author edits it; live uniqueness check.
  useEffect(() => {
    if (!form.slugTouched) {
      const s = autoSlug(form.title);
      setForm((f) => (f.slug === s ? f : { ...f, slug: s }));
    }
  }, [form.title, form.slugTouched]);
  const slugTaken = !!form.slug && data.takenSlugs.includes(form.slug);

  // Build the submission payload.
  const buildPayload = useCallback((): string => {
    return JSON.stringify({
      title: form.title,
      slug: form.slug,
      excerpt: form.excerpt,
      body: form.body,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      sources: form.sources,
      featured: form.featured,
      coverImage: form.coverImage,
      coverAlt: form.coverAlt,
      ogImage: form.ogImage,
      ogImageAlt: form.ogImageAlt,
      seoTitle: form.seoTitle,
      seoDescription: form.seoDescription,
      episodeNumber: form.episodeNumber,
      seasonNumber: form.seasonNumber,
      episodeType: form.episodeType,
      explicit: form.explicit,
      ...form.audio,
      episodeArtwork: form.episodeArtwork,
      episodeArtworkAlt: form.episodeArtworkAlt,
      transcript: form.transcript,
      chapters: form.chapters,
      keyMoments: form.keyMoments,
      guests: form.guests,
      people: form.people,
    });
  }, [form]);

  const submit = useCallback(
    (intent: string, extra: Record<string, string> = {}) => {
      const fd = new FormData();
      fd.set("intent", intent);
      fd.set("payload", buildPayload());
      for (const [k, v] of Object.entries(extra)) fd.set(k, v);
      savedRef.current = JSON.stringify(form);
      void fetcher.submit(fd, { method: "post" });
    },
    [buildPayload, fetcher, form],
  );

  // Debounced autosave (no version snapshot). Skips while a slug clash would reject the write.
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!dirty || slugTaken) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => submit("autosave"), 1800);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [form, dirty, slugTaken, submit]);

  // Unsaved-changes guards (client nav + full reload).
  const blocker = useBlocker(dirty);
  useEffect(() => {
    if (blocker.state === "blocked") {
      if (confirm("You have unsaved changes. Leave anyway?")) blocker.proceed();
      else blocker.reset();
    }
  }, [blocker]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const busy = fetcher.state !== "idle";
  const result = fetcher.data;

  const [scheduleAt, setScheduleAt] = useState("");
  const isScheduled = post.status === "published" && !!post.publishAt && post.publishAt > new Date().toISOString();

  const saveState = useMemo(() => {
    if (busy) return { icon: <Loader2 size={13} className="animate-spin" aria-hidden />, text: "Saving…", tone: "muted" as const };
    if (result && !result.ok) return { icon: <AlertCircle size={13} aria-hidden />, text: result.error ?? "Error", tone: "brand" as const };
    if (dirty) return { icon: <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />, text: "Unsaved changes", tone: "amber" as const };
    return { icon: <Check size={13} aria-hidden />, text: "All changes saved", tone: "accent" as const };
  }, [busy, result, dirty]);

  return (
    <div>
      {/* Sticky action bar */}
      <div className="sticky top-0 z-20 -mx-4 mb-6 border-b border-border bg-bg/85 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/admin/posts" className="font-mono text-xs text-muted hover:text-ink">← Posts</Link>
            <span className="flex items-center gap-1.5 font-mono text-xs" style={{ color: `var(--color-${saveState.tone === "amber" ? "muted" : saveState.tone})` }}>
              {saveState.icon} {saveState.text}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" type="button" onClick={() => window.open(previewUrl, "_blank")}>
              <Eye size={14} aria-hidden /> Preview
            </Button>
            <Button variant="ghost" type="button" disabled={busy || slugTaken} onClick={() => submit("save")}>
              <Save size={14} aria-hidden /> Save
            </Button>
            {post.status === "published" ? (
              <Button variant="ghost" type="button" disabled={busy} onClick={() => submit("unpublish")}>
                Unpublish
              </Button>
            ) : (
              <Button variant="accent" type="button" disabled={busy || slugTaken} onClick={() => submit("publish")}>
                <UploadCloud size={14} aria-hidden /> Publish
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        {/* ── Main column ───────────────────────────────────────── */}
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <Badge tone={isEpisode ? "brand" : "muted"}>
              {isEpisode ? <Headphones size={11} aria-hidden /> : <FileText size={11} aria-hidden />}
              {post.kind}
            </Badge>
            <Badge tone={post.status === "published" ? (isScheduled ? "amber" : "accent") : "muted"}>
              {isScheduled ? "scheduled" : post.status}
            </Badge>
          </div>

          <Field label="Title" required count={{ value: form.title.length, max: 80 }}>
            {({ id }) => (
              <input
                id={id}
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                className={`${inputCx} font-display text-lg`}
              />
            )}
          </Field>

          <Field
            label="Slug"
            error={slugTaken ? "That slug is already taken." : null}
            hint={`URL: ${origin}/${form.slug || "…"}`}
          >
            {({ id, describedBy }) => (
              <div className="flex gap-2">
                <input
                  id={id}
                  aria-describedby={describedBy}
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: autoSlug(e.target.value), slugTouched: true }))}
                  className={inputCx}
                />
                <Button variant="ghost" type="button" onClick={() => setForm((f) => ({ ...f, slug: autoSlug(f.title), slugTouched: false }))}>
                  <RefreshCw size={14} aria-hidden /> Auto
                </Button>
              </div>
            )}
          </Field>

          {isEpisode ? (
            <AiAssist<string>
              kind="shownotes"
              label="Generate show notes"
              transcript={form.transcript}
              available={data.aiAvailable}
              hasTranscript={!!form.transcript.trim()}
              hasExisting={!!form.body.trim()}
              confirmReplaceLabel="body"
              onAccept={(html) => set("body", html)}
              renderPreview={(html) => <BodyRenderer html={html} />}
            />
          ) : null}

          <RichTextEditor value={form.body} onChange={(html) => set("body", html)} postId={post.id} />

          <Field
            label="Excerpt"
            hint="Short summary for cards, the feed description, and search snippets."
            count={{ value: form.excerpt.length, max: 280 }}
          >
            {({ id }) => (
              <textarea id={id} value={form.excerpt} rows={3} onChange={(e) => set("excerpt", e.target.value)} className={inputCx} />
            )}
          </Field>

          <Field label="Tags" hint="Comma-separated.">
            {({ id }) => (
              <input id={id} value={form.tags} onChange={(e) => set("tags", e.target.value)} className={inputCx} />
            )}
          </Field>

          <Card title="Sources & credits" icon={<BookText size={15} aria-hidden />}>
            <SourcesEditor sources={form.sources} onChange={(s) => set("sources", s)} />
          </Card>

          {isEpisode ? (
            <Card title="Episode" icon={<Headphones size={15} aria-hidden />}>
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Number">
                    {({ id }) => <input id={id} type="number" value={form.episodeNumber} onChange={(e) => set("episodeNumber", e.target.value)} className={inputCx} />}
                  </Field>
                  <Field label="Season">
                    {({ id }) => <input id={id} type="number" value={form.seasonNumber} onChange={(e) => set("seasonNumber", e.target.value)} className={inputCx} />}
                  </Field>
                  <Field label="Type">
                    {({ id }) => (
                      <select id={id} value={form.episodeType} onChange={(e) => set("episodeType", e.target.value)} className={inputCx}>
                        <option value="full">full</option>
                        <option value="trailer">trailer</option>
                        <option value="bonus">bonus</option>
                      </select>
                    )}
                  </Field>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={form.explicit} onChange={(e) => set("explicit", e.target.checked)} /> Explicit
                  </label>
                  <span className="font-mono text-[11px] text-muted">
                    GUID (locked): {post.guid ?? "set on first publish"}
                  </span>
                </div>

                <AudioField postId={post.id} value={form.audio} onChange={(patch) => set("audio", { ...form.audio, ...patch })} />
                <hr className="border-border" />
                <TranscriptField value={form.transcript} onChange={(v) => set("transcript", v)} />
                <hr className="border-border" />
                <ChaptersEditor
                  chapters={form.chapters}
                  onChange={(c) => set("chapters", c)}
                  peaks={form.audio.audioPeaks ?? []}
                  duration={form.audio.audioDuration}
                  transcript={form.transcript}
                  aiAvailable={data.aiAvailable}
                />
                <hr className="border-border" />
                <KeyMomentsEditor moments={form.keyMoments} onChange={(m) => set("keyMoments", m)} />
                <hr className="border-border" />
                <GuestsField
                  people={data.people}
                  selected={form.people}
                  onSelectedChange={(s) => set("people", s)}
                  guestsJson={form.guests}
                  onGuestsJsonChange={(g) => set("guests", g)}
                />
              </div>
            </Card>
          ) : null}
        </div>

        {/* ── Sidebar ───────────────────────────────────────────── */}
        <aside className="space-y-5">
          <Card title="Publish" icon={<Megaphone size={15} aria-hidden />}>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge tone={post.status === "published" ? (isScheduled ? "amber" : "accent") : "muted"}>
                  {isScheduled ? "scheduled" : post.status}
                </Badge>
                {post.status === "published" && !isScheduled ? (
                  <Link to={`/${post.slug}`} className="inline-flex items-center gap-1 font-mono text-xs text-accent hover:underline">
                    <ExternalLink size={12} aria-hidden /> view
                  </Link>
                ) : null}
              </div>
              {isScheduled ? (
                <p className="font-mono text-[11px] text-muted">Goes live {post.publishAt}</p>
              ) : null}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.featured} onChange={(e) => set("featured", e.target.checked)} /> Featured
              </label>
              <hr className="border-border" />
              <Field label="Schedule publish" hint="Stays hidden until this time, then appears automatically.">
                {({ id }) => (
                  <input id={id} type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className={inputCx} />
                )}
              </Field>
              <Button
                variant="primary"
                type="button"
                disabled={busy || slugTaken || !scheduleAt}
                onClick={() => submit("schedule", { publishAt: new Date(scheduleAt).toISOString() })}
              >
                <CalendarClock size={14} aria-hidden /> Schedule
              </Button>
            </div>
          </Card>

          <Card title="Media" icon={<ImageIcon size={15} aria-hidden />}>
            <div className="space-y-5">
              <ImageField
                label="Cover image"
                url={form.coverImage}
                alt={form.coverAlt}
                postId={post.id}
                onChange={({ url, alt }) => setForm((f) => ({ ...f, coverImage: url, coverAlt: alt }))}
              />
              <hr className="border-border" />
              <ImageField
                label="Social / OG image"
                url={form.ogImage}
                alt={form.ogImageAlt}
                postId={post.id}
                onChange={({ url, alt }) => setForm((f) => ({ ...f, ogImage: url, ogImageAlt: alt }))}
              />
              {isEpisode ? (
                <>
                  <hr className="border-border" />
                  <ImageField
                    label="Episode artwork"
                    url={form.episodeArtwork}
                    alt={form.episodeArtworkAlt}
                    postId={post.id}
                    onChange={({ url, alt }) => setForm((f) => ({ ...f, episodeArtwork: url, episodeArtworkAlt: alt }))}
                  />
                </>
              ) : null}
            </div>
          </Card>

          <Card title="SEO" icon={<Search size={15} aria-hidden />}>
            <SeoPanel
              slug={form.slug}
              origin={origin}
              seoTitle={form.seoTitle}
              seoDescription={form.seoDescription}
              fallbackTitle={form.title}
              fallbackDescription={form.excerpt}
              image={form.ogImage || form.episodeArtwork || form.coverImage || null}
              imageAlt={form.ogImageAlt || form.coverAlt || null}
              onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
              transcript={form.transcript}
              episodeTitle={form.title}
              aiAvailable={isEpisode && data.aiAvailable}
            />
          </Card>

          <Card title="Version history" icon={<History size={15} aria-hidden />}>
            <VersionHistory versions={data.versions} current={post} />
          </Card>

          <fetcher.Form
            method="post"
            onSubmit={(e) => {
              if (!confirm("Delete this post permanently?")) e.preventDefault();
            }}
          >
            <input type="hidden" name="intent" value="delete" />
            <button className="inline-flex items-center gap-1.5 font-mono text-xs text-muted hover:text-brand">
              <Trash2 size={13} aria-hidden /> Delete post
            </button>
          </fetcher.Form>
        </aside>
      </div>
    </div>
  );
}
