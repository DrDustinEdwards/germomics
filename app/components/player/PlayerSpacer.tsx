// Bottom clearance for the fixed PlayerDock (UI fix). When a track is loaded the dock is pinned
// to the bottom and would otherwise cover the footer; this spacer reserves exactly the player's
// height (the --player-h token) at the end of the page flow, collapsing to 0 when nothing plays.
// Light/dark and mobile/desktop all clear, because the dock height is the same token everywhere.
import { usePlayer } from "./player-context";

export function PlayerSpacer() {
  const p = usePlayer();
  return (
    <div
      aria-hidden
      className="transition-[height] duration-200 ease-out motion-reduce:transition-none"
      style={{ height: p.current ? "calc(var(--player-h) + env(safe-area-inset-bottom))" : "0px" }}
    />
  );
}
