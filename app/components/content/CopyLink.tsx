import { useId } from "react";
import { Icon, iconCheck, iconShare } from "capsomer/react/icons";
import { useCopy } from "capsomer/react/copy";
import { usePlayer } from "capsomer/react/player";
import { timecode } from "capsomer/behavior/time";
import { SITE_ORIGIN } from "~/lib/site";

// Invoker Commands (command, commandfor) are not in React's button types yet; the attributes pass through as written.
const INVOKER = (command: string, commandfor: string): object => ({ command, commandfor });

// Markup only, so a page with no React has it: /site.js (app/site.ts) attaches Capsomer's copy to every command="--copy"
// or "--share" button, resolving `commandfor` to the hidden link beside it. A copy takes the full address, a share the link's own.
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

export function CopyLink({ slug }: { slug: string }) {
  return <CopyButton path={`/${slug}`} label="Share" share icon={iconShare} />;
}

// Copies /<slug>?t=<seconds>, which the detail page reads and seeks to.
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
