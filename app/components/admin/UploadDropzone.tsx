// Drag-drop / click upload target → POSTs to /admin/upload (gated) and reports progress via
// XHR (fetch can't surface upload progress). Reused by the image, audio and transcript fields.
import { useId, useRef, useState } from "react";
import { Icon, iconCloudUpload, iconSpinner } from "capsomer/react/icons";

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
  onFilePicked,
  onUploaded,
}: {
  kind: "image" | "audio";
  postId: number | string;
  accept: string;
  label: string;
  onFilePicked?: (file: File) => void;
  onUploaded: (result: UploadResult & { file: File }) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handle(file: File) {
    setError(null);
    onFilePicked?.(file);
    setProgress(0);
    // The file is the body, so the server can stream an episode to R2 without holding it (admin.upload.ts).
    const query = new URLSearchParams({ kind, postId: String(postId), name: file.name });
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/admin/upload?${query}`);
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);
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
        onUploaded({ ...res, file });
      } catch {
        setError("Upload failed (bad response).");
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setError("Network error during upload.");
    };
    xhr.send(file);
  }

  const busy = progress !== null;

  return (
    <div>
      {/* The drop target for a dragged file; the label and its input are the control, for every other way in. */}
      <div
        role="presentation"
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handle(file);
        }}
      >
        <label
          htmlFor={inputId}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition ${
            dragging ? "border-accent bg-accent/5" : "border-border bg-surface hover:border-brand"
          }`}
        >
          {busy ? (
            <Icon d={iconSpinner} className="size-[22px] animate-spin text-accent" />
          ) : (
            <Icon d={iconCloudUpload} className="size-[22px] text-brand" />
          )}
          <span className="font-display text-sm text-ink">{label}</span>
          <span className="text-xs text-muted">Drag &amp; drop or click to choose</span>
          <input
            id={inputId}
            ref={inputRef}
            type="file"
            accept={accept}
            className="cap-sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handle(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {busy ? (
        <div className="mt-2" aria-live="polite">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface">
            <div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 font-mono text-[0.6875rem] text-muted">Uploading… {progress}%</p>
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
