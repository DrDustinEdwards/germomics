import { Icon, iconExternal } from "capsomer/react/icons";

// Visual + assistive cue for links that leave the site (they open in the same tab, as every public link does). The small muted
// glyph is the visible signal; the visually-hidden text gives assistive tech the same warning. Use
// it only on outbound links, never on internal navigation, so the cue keeps meaning something.
// Its size is the link's (site.css, the icon sizes).
export function ExternalCue() {
  return (
    <>
      <Icon d={iconExternal} className="gm-external-cue" />
      <span className="cap-sr-only"> (another site)</span>
    </>
  );
}
