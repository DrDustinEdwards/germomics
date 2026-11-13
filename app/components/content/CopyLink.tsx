import { useId } from "react";
import { Icon, iconCheck, iconShare } from "capsomer/react/icons";
import { useCopy } from "capsomer/react/copy";
import { usePlayer } from "capsomer/react/player";
import { timecode } from "capsomer/behavior/time";
import { SITE_ORIGIN } from "~/lib/site";

// The share buttons are Capsomer's copy (components/copy): the icon turns to a check and a bubble beside the button says
// Copied or Copy failed, which is also its status region. The pill is germomics' own (gm-pill, site.css).

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
  icon,
  className = "gm-pill",
}: {
  path: string;
  label: string;
  share?: boolean;
  // The icon's drawing, a Capsomer icon path.
  icon: string;
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
          <Icon d={icon} />
        </span>
        <span className="cap-copy-done">
          <Icon d={iconCheck} />
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
  return <CopyButton path={`/${slug}`} label="Share" share icon={iconShare} />;
}

// Copies a deep link to the current playhead: /<slug>?t=<seconds>. The detail page reads ?t
// and seeks after the episode loads.
export function ShareTimestamp({ slug }: { slug: string }) {
  const p = usePlayer();
  const { copy, state, message } = useCopy();
  const at = Math.floor(p.current?.href === `/${slug}` ? p.currentTime : 0);
  return (
    <span className="cap-copy">
      <button
        type="button"
        data-state={state}
        onClick={() => void copy(`${window.location.origin}/${slug}?t=${at}`)}
        className={"cap-copy-button gm-pill"}
      >
        <span className="cap-copy-icon">
          <Icon d={iconShare} />
        </span>
        <span className="cap-copy-done">
          <Icon d={iconCheck} />
        </span>
        {`Share at ${timecode(at * 1000)}`}
      </button>
      <span className="cap-copy-tip" role="status">
        {message}
      </span>
    </span>
  );
}
