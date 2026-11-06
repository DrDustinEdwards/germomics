// Dual-input transcript field (§C): upload a .vtt/.srt file OR paste raw VTT/text. SRT is
// converted to VTT on import; the value is stored as VTT (keeping the VTT-native rendering). A
// parsed preview shows cue count + the first lines so the author can confirm it parsed.
import { useMemo, useRef, useState } from "react";
import { Captions, ClipboardPaste, FileUp } from "lucide-react";
import { Tabs, inputCx } from "./ui";
import { parseVtt, srtToVtt, isProbablyVtt } from "~/lib/vtt";
import { formatDuration } from "~/lib/format";

export function TranscriptField({
  value,
  onChange,
}: {
  value: string;
  onChange: (vtt: string) => void;
}) {
  const [tab, setTab] = useState<"upload" | "paste">(value ? "paste" : "upload");
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const cues = useMemo(() => parseVtt(value), [value]);

  async function readFile(file: File) {
    const text = await file.text();
    const isSrt = file.name.toLowerCase().endsWith(".srt") || (!isProbablyVtt(text) && /-->/.test(text));
    const vtt = isSrt ? srtToVtt(text) : text;
    onChange(vtt);
    setNote(isSrt ? "Converted SRT → VTT." : "Loaded VTT.");
    setTab("paste");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-display text-sm font-medium text-ink">
          <Captions size={14} aria-hidden /> Transcript
        </span>
        <Tabs
          label="Transcript input method"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "upload", label: "Upload", icon: <FileUp size={13} aria-hidden /> },
            { value: "paste", label: "Paste", icon: <ClipboardPaste size={13} aria-hidden /> },
          ]}
        />
      </div>

      {tab === "upload" ? (
        <label
          htmlFor="transcript-file"
          className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-border bg-surface px-4 py-6 text-center hover:border-brand"
        >
          <FileUp className="text-brand" size={20} aria-hidden />
          <span className="font-display text-sm text-ink">Upload .vtt or .srt</span>
          <span className="text-xs text-muted">Click to choose a caption file</span>
          <input
            id="transcript-file"
            ref={fileRef}
            type="file"
            accept=".vtt,.srt,text/vtt"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void readFile(f);
              e.target.value = "";
            }}
          />
        </label>
      ) : (
        <textarea
          value={value}
          rows={8}
          spellCheck={false}
          placeholder="WEBVTT&#10;&#10;00:00:00.000 --> 00:00:02.000&#10;Welcome…"
          className={`${inputCx} font-mono text-xs`}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {note ? <p className="text-xs text-accent">{note}</p> : null}

      {value ? (
        cues.length ? (
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="mb-2 font-mono text-[11px] text-muted">
              Parsed {cues.length} cues · {formatDuration(Math.round(cues[cues.length - 1]?.end ?? 0))}
            </p>
            <ul className="space-y-1 text-xs text-ink">
              {cues.slice(0, 4).map((c, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-mono text-[11px] text-accent">{formatDuration(Math.floor(c.start))}</span>
                  <span className="line-clamp-1">{c.text}</span>
                </li>
              ))}
              {cues.length > 4 ? <li className="text-muted">…</li> : null}
            </ul>
          </div>
        ) : (
          <p role="alert" className="text-xs text-brand">
            Couldn’t parse any VTT cues. Check the format (needs a WEBVTT header and timing lines).
          </p>
        )
      ) : null}
    </div>
  );
}
