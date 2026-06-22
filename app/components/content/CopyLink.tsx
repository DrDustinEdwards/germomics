import { useState } from "react";
import { Share2, Check } from "lucide-react";

// Copy a share link to this post. Uses the Web Share sheet on supporting devices, else clipboard.
export function CopyLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  const onClick = async () => {
    const url = `${window.location.origin}/${slug}`;
    try {
      if (navigator.share) {
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
      {copied ? "Copied" : "Share"}
    </button>
  );
}
