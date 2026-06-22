// Drag-drop / click upload target → POSTs to /admin/upload (gated) and reports progress via
// XHR (fetch can't surface upload progress). Reused by the image, audio and transcript fields.
// An optional `transform` runs client-side before upload (e.g. image downscale).
import { useId, useRef, useState } from "react";
import { UploadCloud, Loader2 } from "lucide-react";

export type UploadResult = {
  ok: boolean;
  url?: string;
  size?: number;
  contentType?: string;
  name?: string;
  error?: string;
};

export function UploadDropzone({
  kind,
  postId,
  accept,
  label,
  transform,
  onFilePicked,
  onUploaded,
}: {
  kind: "image" | "audio";
  postId: number | string;
  accept: string;
  label: string;
  transform?: (file: File) => Promise<File>;
  onFilePicked?: (file: File) => void;
  onUploaded: (result: UploadResult & { file: File }) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(file: File) {
    setError(null);
    onFilePicked?.(file);
    let toSend = file;
    try {
      if (transform) toSend = await transform(file);
    } catch {
      /* fall back to original on transform failure */
    }
    setProgress(0);
    const body = new FormData();
    body.set("file", toSend);
    body.set("kind", kind);
    body.set("postId", String(postId));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/admin/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      setProgress(null);
      try {
        const res = JSON.parse(xhr.responseText) as UploadResult;
        if (!res.ok) {
          setError(res.error || "Upload failed.");
          return;
        }
        onUploaded({ ...res, file: toSend });
      } catch {
        setError("Upload failed (bad response).");
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setError("Network error during upload.");
    };
    xhr.send(body);
  }

  const busy = progress !== null;

  return (
    <div>
      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handle(file);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
          dragging ? "border-accent bg-accent/5" : "border-border bg-surface hover:border-brand"
        }`}
      >
        {busy ? (
          <Loader2 className="animate-spin text-accent" size={22} aria-hidden />
        ) : (
          <UploadCloud className="text-brand" size={22} aria-hidden />
        )}
        <span className="font-display text-sm text-ink">{label}</span>
        <span className="text-xs text-muted">Drag &amp; drop or click to choose</span>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handle(file);
            e.target.value = "";
          }}
        />
      </label>

      {busy ? (
        <div className="mt-2" aria-live="polite">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface">
            <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 font-mono text-[11px] text-muted">Uploading… {progress}%</p>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-brand">
          {error}
        </p>
      ) : null}
    </div>
  );
}
