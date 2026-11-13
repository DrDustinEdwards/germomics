// Dual-input audio field (§C): "Upload" (MP3 → media.germomics.com, auto duration + byte size +
// MIME + waveform peaks) OR "URL / Paste" (external enclosure). Byte size is the server-trusted
// value returned by R2; duration + peaks are computed in the browser from the decoded file.
import { useState } from "react";
import { Icon, iconSpinner } from "capsomer/react/icons";
import { Field } from "capsomer/react/field";
import { Segmented } from "capsomer/react/segmented";
import { UploadDropzone } from "./UploadDropzone";
import { decodePeaks, probeDuration } from "capsomer/behavior/player";
import { WaveformPreview } from "capsomer/react/player";
import { timecode } from "capsomer/behavior/time";

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
      const result = await decodePeaks(buf);
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
        <Segmented
          legend="Audio input method"
          value={tab}
          onChange={setTab}
          hideLegend
          options={[
            {
              value: "upload",
              label: "Upload",
            },
            {
              value: "url",
              label: "URL",
            },
          ]}
        />
      </div>

      {value.audioUrl ? (
        <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
          <p className="truncate font-mono text-[0.6875rem] text-muted">{value.audioUrl}</p>
          <div className="flex flex-wrap items-center gap-3 font-mono text-[0.6875rem] text-muted">
            <span>dur {timecode((value.audioDuration ?? 0) * 1000)}</span>
            <span>
              {value.audioByteSize ? `${(value.audioByteSize / 1e6).toFixed(1)} MB` : "size n/a"}
            </span>
            <span>{value.audioMimeType ?? "audio/mpeg"}</span>
            {analyzing ? (
              <span className="flex items-center gap-1 text-accent">
                <Icon d={iconSpinner} className="size-3 animate-spin" /> analyzing…
              </span>
            ) : null}
          </div>
          <WaveformPreview peaks={value.audioPeaks ?? []} label="Episode audio waveform" />
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
          <Field label="Audio URL" help="External enclosure URL (e.g. an existing host).">
            {(control) => (
              <input
                {...control}
                type="url"
                value={value.audioUrl}
                placeholder="https://media.germomics.com/…mp3"
                className="cap-input"
                onChange={(e) => onChange({ audioUrl: e.target.value })}
              />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Duration (seconds)">
              {(control) => (
                <input
                  {...control}
                  type="number"
                  value={value.audioDuration ?? ""}
                  className="cap-input"
                  onChange={(e) =>
                    onChange({ audioDuration: e.target.value ? Number(e.target.value) : null })
                  }
                />
              )}
            </Field>
            <Field label="Byte size">
              {(control) => (
                <input
                  {...control}
                  type="number"
                  value={value.audioByteSize ?? ""}
                  className="cap-input"
                  onChange={(e) =>
                    onChange({ audioByteSize: e.target.value ? Number(e.target.value) : null })
                  }
                />
              )}
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}
