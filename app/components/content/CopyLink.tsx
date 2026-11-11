import type { ComponentType } from "react";
import { Check, CircleAlert, Share2 } from "lucide-react";
import { COPY_MESSAGE, shareOrCopy } from "~/lib/copy-status";
import { useCopyFeedback } from "~/lib/use-copy-feedback";
import { usePlayer } from "~/components/player/player-context";
import { formatDuration } from "~/lib/format";

// One share button: `share` offers the Web Share sheet where the device has one, else (or always,
// without it) the link goes to the clipboard. The button reads "Copied" or "Copy failed" for a
// moment, and the status region beside it says so (app/lib/copy-status.ts).
function ShareButton({
  path,
  label,
  share = false,
}: {
  path: string;
  label: string;
  share?: boolean;
}) {
  const { outcome, label: said, message, report } = useCopyFeedback();

  const copy = async () => {
    const result = await shareOrCopy(`${window.location.origin}${path}`, share);
    if (result === "copied" || result === "failed") report(result);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void copy()}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-mono text-xs hover:border-accent hover:text-accent"
      >
        {outcome === "copied" ? (
          <Check size={14} aria-hidden />
        ) : outcome === "failed" ? (
          <CircleAlert size={14} aria-hidden />
        ) : (
          <Share2 size={14} aria-hidden />
        )}
        {outcome ? said : label}
      </button>
      <span role="status" className="sr-only">
        {message}
      </span>
    </>
  );
}

/**
 * A button that copies a link to this site, or with `share` offers the Web Share sheet where the device has one. The
 * markup only, so a page that sends no React has it: /site.js does the copying and shows "Copied" or "Copy failed" for
 * a moment (app/site/share.ts). Every state is rendered and the script swaps which is hidden; the status region after
 * the button carries the same words for a screen reader.
 */
export function CopyButton({
  path,
  label,
  share = false,
  icon: Icon,
  className,
}: {
  path: string;
  label: string;
  share?: boolean;
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  className: string;
}) {
  return (
    <>
      <button
        type="button"
        data-copy={path}
        data-share={share ? "" : undefined}
        className={className}
      >
        <span className="contents" data-copy-idle>
          <Icon size={14} aria-hidden />
          {label}
        </span>
        <span className="contents" data-copy-done hidden>
          <Check size={14} aria-hidden />
          {COPY_MESSAGE.copied}
        </span>
        <span className="contents" data-copy-failed hidden>
          <CircleAlert size={14} aria-hidden />
          {COPY_MESSAGE.failed}
        </span>
      </button>
      <span role="status" className="sr-only" data-copy-status />
    </>
  );
}

// Share a link to this post.
export function CopyLink({ slug }: { slug: string }) {
  return (
    <CopyButton
      path={`/${slug}`}
      label="Share"
      share
      icon={Share2}
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-mono text-xs hover:border-accent hover:text-accent"
    />
  );
}

// Copies a deep link to the current playhead: /<slug>?t=<seconds>. The detail page reads ?t
// and seeks after the episode loads.
export function ShareTimestamp({ slug }: { slug: string }) {
  const p = usePlayer();
  const at = Math.floor(p.current?.slug === slug ? p.currentTime : 0);
  return <ShareButton path={`/${slug}?t=${at}`} label={`Share at ${formatDuration(at)}`} />;
}
