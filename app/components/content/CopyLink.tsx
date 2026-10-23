import { useState } from "react";
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

// Share a link to this post.
export function CopyLink({ slug }: { slug: string }) {
  return <ShareButton path={`/${slug}`} label="Share" share />;
}

// Copies a deep link to the current playhead: /<slug>?t=<seconds>. The detail page reads ?t
// and seeks after the episode loads.
export function ShareTimestamp({ slug }: { slug: string }) {
  const p = usePlayer();
  const at = Math.floor(p.current?.slug === slug ? p.currentTime : 0);
  return <ShareButton path={`/${slug}?t=${at}`} label={`Share at ${formatDuration(at)}`} />;
}
