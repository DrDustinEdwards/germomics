// Dual-input image field (§C): "Upload" (drag-drop → BLOG_IMAGES, stored as /media/<key>, shrunk on the server
// past 4096px, thumbnail preview) OR "URL / Paste". Alt text is required whenever an image is set — we retire
// URL-only fields here. Emits { url, alt } upward.
import { useState } from "react";
import { ImageUp, Link2, X } from "lucide-react";
import { Tabs, Field, inputCx, Button } from "./ui";
import { UploadDropzone } from "./UploadDropzone";

export function ImageField({
  label,
  url,
  alt,
  postId,
  onChange,
  required,
}: {
  label: string;
  url: string;
  alt: string;
  postId: number | string;
  onChange: (next: { url: string; alt: string }) => void;
  required?: boolean;
}) {
  const [tab, setTab] = useState<"upload" | "url">("url");
  const altMissing = !!url && !alt.trim();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-sm font-medium text-ink">{label}</span>
        <Tabs
          label={`${label} input method`}
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "upload", label: "Upload", icon: <ImageUp size={13} aria-hidden /> },
            { value: "url", label: "URL", icon: <Link2 size={13} aria-hidden /> },
          ]}
        />
      </div>

      {url ? (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3">
          {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
          <img src={url} alt={alt || "preview"} className="h-20 w-20 shrink-0 rounded-lg border border-border object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[11px] text-muted">{url}</p>
            <Button
              variant="danger"
              type="button"
              className="mt-2 min-h-0 px-2 py-1 text-xs"
              onClick={() => onChange({ url: "", alt: "" })}
            >
              <X size={12} aria-hidden /> Remove
            </Button>
          </div>
        </div>
      ) : null}

      {tab === "upload" ? (
        <UploadDropzone
          kind="image"
          postId={postId}
          accept="image/*"
          label="Upload image"
          onUploaded={(r) => r.url && onChange({ url: r.url, alt })}
        />
      ) : (
        <Field label="Image URL" hint="Paste an absolute https:// image URL.">
          {({ id }) => (
            <input
              id={id}
              type="text"
              inputMode="url"
              value={url}
              placeholder="/media/…"
              className={inputCx}
              onChange={(e) => onChange({ url: e.target.value, alt })}
            />
          )}
        </Field>
      )}

      <Field
        label="Alt text"
        required={required ?? !!url}
        error={altMissing ? "Alt text is required for accessibility." : null}
        hint="Describe the image for screen readers and when it fails to load."
      >
        {({ id, describedBy }) => (
          <input
            id={id}
            aria-describedby={describedBy}
            value={alt}
            className={inputCx}
            onChange={(e) => onChange({ url, alt: e.target.value })}
          />
        )}
      </Field>
    </div>
  );
}
