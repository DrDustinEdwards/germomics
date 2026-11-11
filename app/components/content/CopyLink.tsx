import { useId, type ComponentType } from "react";
import { Check, Share2 } from "lucide-react";
import { useCopy } from "capsomer/react/copy";
import { usePlayer } from "~/components/player/player-context";
import { formatDuration } from "~/lib/format";
import { SITE_ORIGIN } from "~/lib/site";

// The share buttons are Capsomer's copy (components/copy): the icon turns to a check and a bubble beside the button says
// Copied or Copy failed, which is also its status region. The pill is germomics' own.
const PILL =
  "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-mono text-xs hover:border-accent hover:text-accent [&_svg]:size-3.5";

// Invoker Commands (command, commandfor) are not in React's button types yet; the attributes pass through as written.
const INVOKER = (command: string, commandfor: string): object => ({ command, commandfor });

// A button that copies a link to a page of this site, or with `share` offers the Web Share sheet where the device has
// one. The markup only, so a page that sends no React has it: /site.js attaches Capsomer's copy to every
// command="--copy" or "--share" button (app/site.ts), which resolves `commandfor` to the link it shares. The link is
// rendered hidden beside the button, so its address is in the page whatever script does; a copy takes the address
// in full (this site's own origin), a share the link's own.
export function CopyButton({
  path,
  label,
  share = false,
  icon: Icon,
  className = PILL,
}: {
  path: string;
  label: string;
  share?: boolean;
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
  className?: string;
}) {
  const id = useId();
  return (
    <span className="cap-copy">
      <button
        type="button"
        {...INVOKER(share ? "--share" : "--copy", id)}
        className={`cap-copy-button ${className}`}
      >
        <span className="cap-copy-icon">
          <Icon size={14} aria-hidden />
        </span>
        <span className="cap-copy-done">
          <Check size={14} aria-hidden />
        </span>
        {label}
      </button>
      <span className="cap-copy-tip" role="status" />
      <a id={id} href={path} hidden>
        {`${SITE_ORIGIN}${path}`}
      </a>
    </span>
  );
}

// Share a link to this post.
export function CopyLink({ slug }: { slug: string }) {
  return <CopyButton path={`/${slug}`} label="Share" share icon={Share2} />;
}

// Copies a deep link to the current playhead: /<slug>?t=<seconds>. The detail page reads ?t
// and seeks after the episode loads.
export function ShareTimestamp({ slug }: { slug: string }) {
  const p = usePlayer();
  const { copy, state, message } = useCopy();
  const at = Math.floor(p.current?.slug === slug ? p.currentTime : 0);
  return (
    <span className="cap-copy">
      <button
        type="button"
        data-state={state}
        onClick={() => void copy(`${window.location.origin}/${slug}?t=${at}`)}
        className={`cap-copy-button ${PILL}`}
      >
        <span className="cap-copy-icon">
          <Share2 size={14} aria-hidden />
        </span>
        <span className="cap-copy-done">
          <Check size={14} aria-hidden />
        </span>
        {`Share at ${formatDuration(at)}`}
      </button>
      <span className="cap-copy-tip" role="status">
        {message}
      </span>
    </span>
  );
}
