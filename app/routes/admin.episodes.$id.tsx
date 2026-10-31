// One episode's audio and transcript, the only post fields the admin writes (Carrel writes the rest; Dustin,
// 2026-10-29). Both are files the browser works on before the site stores them: the MP3 goes to germomics-audio
// (admin.upload.ts, up to 100 MB, past Carrel's 25 MiB media limit) and its duration and waveform peaks are measured
// from the decoded file; a transcript is a .vtt or .srt file, SRT converted to WebVTT. The row is snapshotted into
// post_versions before each save, as every Carrel write does, and the guid is never touched.
import { useState } from "react";
import { useFetcher } from "react-router";
import { Link } from "capsomer/react/link";
import { ExternalLink, Save } from "lucide-react";
import type { Route } from "./+types/admin.episodes.$id";
import { getEnv } from "~/lib/context.server";
import { getPostById } from "~/lib/posts.server";
import { snapshotVersion, updatePost } from "~/lib/admin.server";
import { carrelEditUrl } from "~/lib/site";
import { AudioField, type AudioState } from "~/components/admin/AudioField";
import { TranscriptField } from "~/components/admin/TranscriptField";
import { Button, Card } from "~/components/admin/ui";
import { ADMIN_FORM, readForm } from "~/lib/body.server";

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const whole = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);

async function episode(env: Env, id: string) {
  const post = await getPostById(env, Number(id));
  if (!post || post.kind !== "episode") throw new Response("Not found", { status: 404 });
  return post;
}

export async function loader({ params, context }: Route.LoaderArgs) {
  const post = await episode(getEnv(context), params.id);
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    guid: post.guid,
    audio: {
      audioUrl: post.audioUrl ?? "",
      audioDuration: post.audioDuration,
      audioByteSize: post.audioByteSize,
      audioMimeType: post.audioMimeType,
      audioPeaks: post.audioPeaks,
    } satisfies AudioState,
    transcript: post.transcript ?? "",
  };
}

export async function action({ params, request, context }: Route.ActionArgs) {
  const env = getEnv(context);
  const post = await episode(env, params.id);
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(String((await readForm(request, ADMIN_FORM)).get("payload") ?? "{}"));
  } catch {
    return { ok: false as const, error: "Bad payload." };
  }
  const peaks = payload.audioPeaks;
  await snapshotVersion(env, post, "audio");
  await updatePost(env, post.id, {
    audioUrl: text(payload.audioUrl),
    audioDuration: whole(payload.audioDuration),
    audioByteSize: whole(payload.audioByteSize),
    audioMimeType: text(payload.audioMimeType) ?? "audio/mpeg",
    audioPeaks: Array.isArray(peaks) && peaks.every((n) => typeof n === "number") ? (peaks as number[]) : null,
    transcript: text(payload.transcript),
  });
  return { ok: true as const, message: "Saved." };
}

export default function EpisodeAudio({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher<{ ok: boolean; message?: string; error?: string }>();
  const [audio, setAudio] = useState<AudioState>(loaderData.audio);
  const [transcript, setTranscript] = useState(loaderData.transcript);
  const save = () => {
    const form = new FormData();
    form.set("payload", JSON.stringify({ ...audio, transcript }));
    void fetcher.submit(form, { method: "post" });
  };
  const result = fetcher.data;

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin/episodes" className="font-mono text-xs text-muted hover:text-ink">← Episode audio</Link>
          <h1 className="mt-1 font-display text-2xl font-semibold">{loaderData.title}</h1>
          <p className="font-mono text-[11px] text-muted">GUID (locked): {loaderData.guid ?? "set on first publish"}</p>
        </div>
        <div className="flex items-center gap-2">
          <a href={carrelEditUrl(loaderData.slug)} className="inline-flex items-center gap-1.5 font-display text-sm text-muted hover:text-ink">
            <ExternalLink size={14} aria-hidden /> Write in Carrel
          </a>
          <Button type="button" disabled={fetcher.state !== "idle"} onClick={save}>
            <Save size={14} aria-hidden /> Save
          </Button>
        </div>
      </div>
      {result ? (
        <p role="status" className={`text-sm ${result.ok ? "text-accent" : "text-brand"}`}>
          {result.ok ? result.message : result.error}
        </p>
      ) : null}
      <Card>
        <AudioField postId={loaderData.id} value={audio} onChange={(patch) => setAudio((a) => ({ ...a, ...patch }))} />
      </Card>
      <Card>
        <TranscriptField value={transcript} onChange={setTranscript} />
      </Card>
    </div>
  );
}
