// Dual-input audio field (§C): "Upload" (MP3 → media.germomics.com, auto duration + byte size +
// MIME + waveform peaks) OR "URL / Paste" (external enclosure). Byte size is the server-trusted
// value returned by R2; duration + peaks are computed in the browser from the decoded file.
import { useState } from "react";
import { FileAudio2, Link2, Loader2 } from "lucide-react";
import { Tabs, Field, inputCx } from "./ui";
import { UploadDropzone } from "./UploadDropzone";
import { Waveform } from "./Waveform";
import { computePeaks, probeDuration } from "~/lib/waveform-client";
import { formatDuration } from "~/lib/format";

export type AudioState = {
  audioUrl: string;
  audioDuration: number | null;
  audioByteSize: number | null;
  audioMimeType: string | null;
  audioPeaks: number[] | null;
};

export function AudioField({
  postId,
  value,
  onChange,
}: {
  postId: number | string;
  value: AudioState;
  onChange: (next: Partial<AudioState>) => void;
}) {
  const [tab, setTab] = useState<"upload" | "url">(value.audioUrl ? "url" : "upload");
  const [analyzing, setAnalyzing] = useState(false);

  async function analyze(file: File) {
    setAnalyzing(true);
    const quick = await probeDuration(file);
    if (quick) onChange({ audioDuration: quick });
    try {
      const buf = await file.arrayBuffer();
      const result = await computePeaks(buf);
      if (result) {
        onChange({ audioPeaks: result.peaks, audioDuration: Math.floor(result.duration) || quick });
      }
    } catch {
      /* keep quick duration */
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-sm font-medium text-ink">Audio</span>
        <Tabs
          label="Audio input method"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "upload", label: "Upload", icon: <FileAudio2 size={13} aria-hidden /> },
            { value: "url", label: "URL", icon: <Link2 size={13} aria-hidden /> },
          ]}
        />
      </div>

      {value.audioUrl ? (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
          <p className="truncate font-mono text-[11px] text-muted">{value.audioUrl}</p>
          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] text-muted">
            <span>dur {formatDuration(value.audioDuration)}</span>
            <span>{value.audioByteSize ? `${(value.audioByteSize / 1e6).toFixed(1)} MB` : "size n/a"}</span>
            <span>{value.audioMimeType ?? "audio/mpeg"}</span>
            {analyzing ? (
              <span className="flex items-center gap-1 text-accent">
                <Loader2 size={12} className="animate-spin" aria-hidden /> analyzing…
              </span>
            ) : null}
          </div>
          <Waveform peaks={value.audioPeaks ?? []} ariaLabel="Episode audio waveform" />
        </div>
      ) : null}

      {tab === "upload" ? (
        <UploadDropzone
          kind="audio"
          postId={postId}
          accept="audio/*"
          label="Upload MP3"
          onFilePicked={(f) => void analyze(f)}
          onUploaded={(r) =>
            onChange({
              audioUrl: r.url ?? "",
              audioByteSize: r.size ?? null,
              audioMimeType: r.contentType ?? "audio/mpeg",
            })
          }
        />
      ) : (
        <div className="space-y-3">
          <Field label="Audio URL" hint="External enclosure URL (e.g. an existing host).">
            {({ id }) => (
              <input
                id={id}
                type="url"
                value={value.audioUrl}
                placeholder="https://media.germomics.com/…mp3"
                className={inputCx}
                onChange={(e) => onChange({ audioUrl: e.target.value })}
              />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Duration (seconds)">
              {({ id }) => (
                <input
                  id={id}
                  type="number"
                  value={value.audioDuration ?? ""}
                  className={inputCx}
                  onChange={(e) => onChange({ audioDuration: e.target.value ? Number(e.target.value) : null })}
                />
              )}
            </Field>
            <Field label="Byte size">
              {({ id }) => (
                <input
                  id={id}
                  type="number"
                  value={value.audioByteSize ?? ""}
                  className={inputCx}
                  onChange={(e) => onChange({ audioByteSize: e.target.value ? Number(e.target.value) : null })}
                />
              )}
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}
