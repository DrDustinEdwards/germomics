import { useState, type ComponentType } from "react";
import { Share2, Check } from "lucide-react";
import { usePlayer } from "~/components/player/player-context";
import { formatDuration } from "~/lib/format";

// One share button: `share` offers the Web Share sheet where the device has one, else (or always,
// without it) the link goes to the clipboard and the label reads "Copied" for a moment.
function ShareButton({ path, label, share = false }: { path: string; label: string; share?: boolean }) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    const url = `${window.location.origin}${path}`;
    try {
      if (share && navigator.share) {
        await navigator.share({ url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* dismissed / blocked */
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-mono text-xs hover:border-accent hover:text-accent"
    >
      {copied ? <Check size={14} aria-hidden /> : <Share2 size={14} aria-hidden />}
      {copied ? "Copied" : label}
    </button>
  );
}

/**
 * A button that copies a link to this site, or with `share` offers the Web Share sheet where the device has one. The
 * markup only, so a page that sends no React has it: /site.js does the copying and shows "Copied" for a moment
 * (app/site/share.ts). Both states are rendered and the script swaps which is hidden.
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
    <button type="button" data-copy={path} data-share={share ? "" : undefined} className={className}>
      <span className="contents" data-copy-idle>
        <Icon size={14} aria-hidden />
        {label}
      </span>
      <span className="contents" data-copy-done hidden>
        <Check size={14} aria-hidden />
        Copied
      </span>
    </button>
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
