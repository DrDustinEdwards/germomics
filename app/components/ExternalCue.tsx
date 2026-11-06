import { ExternalLink } from "lucide-react";

// Visual + assistive cue for links that leave the site (they open in the same tab, as every public link does). The small muted
// glyph is the visible signal; the visually-hidden text gives assistive tech the same warning. Use
// it only on outbound links, never on internal navigation, so the cue keeps meaning something.
export function ExternalCue({ size = 12 }: { size?: number }) {
  return (
    <>
      <ExternalLink size={size} aria-hidden className="shrink-0 text-muted/70" />
      <span className="sr-only"> (another site)</span>
    </>
  );
}
