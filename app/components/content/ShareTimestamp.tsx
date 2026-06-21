import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { usePlayer } from "~/components/player/player-context";
import { formatDuration } from "~/lib/format";

// Copies a deep link to the current playhead: /<slug>?t=<seconds>. The detail page reads ?t
// and seeks after the episode loads.
export function ShareTimestamp({ slug }: { slug: string }) {
  const p = usePlayer();
  const [copied, setCopied] = useState(false);
  const at = Math.floor(p.current?.slug === slug ? p.currentTime : 0);

  const onClick = async () => {
    const url = `${window.location.origin}/${slug}?t=${at}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-mono text-xs hover:border-accent hover:text-accent"
    >
      {copied ? <Check size={14} aria-hidden /> : <Share2 size={14} aria-hidden />}
      {copied ? "Copied" : `Share at ${formatDuration(at)}`}
    </button>
  );
}
