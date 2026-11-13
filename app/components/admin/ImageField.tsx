// Dual-input image field (§C): "Upload" (drag-drop → BLOG_IMAGES, stored as /media/<key>, shrunk on the server
// past 2560px, thumbnail preview) OR "URL / Paste". Alt text is required whenever an image is set — we retire
// URL-only fields here. Emits { url, alt } upward.
import { useState } from "react";
import { Icon } from "capsomer/react/icons";
import { Field } from "capsomer/react/field";
import { Button } from "capsomer/react/button";
import { Segmented } from "capsomer/react/segmented";
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
        <Segmented
          legend={`${label} input method`}
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

      {url ? (
        <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-3">
          <img
            src={url}
            alt={alt || "preview"}
            className="h-20 w-20 shrink-0 rounded-lg border border-border object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[0.6875rem] text-muted">{url}</p>
            <Button
              variant="danger"
              size="sm"
              type="button"
              className="mt-2"
              onClick={() => onChange({ url: "", alt: "" })}
            >
              <Icon name="close" className="size-3" /> Remove
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
        <Field label="Image URL" help="Paste an absolute https:// image URL.">
          {(control) => (
            <input
              {...control}
              type="text"
              inputMode="url"
              value={url}
              placeholder="/media/…"
              className="cap-input"
              onChange={(e) => onChange({ url: e.target.value, alt })}
            />
          )}
        </Field>
      )}

      <Field
        label="Alt text"
        required={required ?? !!url}
        error={altMissing ? "Alt text is required for accessibility." : null}
        help="Describe the image for screen readers and when it fails to load."
      >
        {(control) => (
          <input
            {...control}
            value={alt}
            className="cap-input"
            onChange={(e) => onChange({ url, alt: e.target.value })}
          />
        )}
      </Field>
    </div>
  );
}
