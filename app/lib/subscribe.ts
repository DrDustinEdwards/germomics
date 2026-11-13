// Subscribe destinations: key -> { label, icon, tier }. Keys match show_config.subscribe_links.
// Primary apps get prominent placement (footer Listen column + buttons on /subscribe); secondary
// directories show under "More directories" on /subscribe. Both tiers stay in subscribe_links (and
// thus Organization/PodcastSeries sameAs). The Android/Email/RSS mechanisms are NOT here (they are
// feed redirects, not identity profiles) and live only on the /subscribe page.
import {
  iconAntenna,
  iconDisc,
  iconLibrary,
  iconMusic,
  iconMusicNote,
  iconPodcast,
  iconRadio,
  iconStar,
} from "capsomer/behavior/icons";

type SubTier = "primary" | "secondary";
export type SubDest = { label: string; tier: SubTier; icon: string };

export const SUBSCRIBE_DESTINATIONS: Record<string, SubDest> = {
  apple: { label: "Apple Podcasts", tier: "primary", icon: iconPodcast },
  spotify: { label: "Spotify", tier: "primary", icon: iconMusic },
  amazon: { label: "Amazon Music", tier: "primary", icon: iconMusicNote },
  pandora: { label: "Pandora", tier: "primary", icon: iconRadio },
  tunein: { label: "TuneIn", tier: "primary", icon: iconAntenna },
  deezer: { label: "Deezer", tier: "secondary", icon: iconDisc },
  podcastindex: { label: "Podcast Index", tier: "secondary", icon: iconLibrary },
  podchaser: { label: "Podchaser", tier: "secondary", icon: iconStar },
};

const keysOf = (tier: SubTier) =>
  Object.keys(SUBSCRIBE_DESTINATIONS).filter((k) => SUBSCRIBE_DESTINATIONS[k].tier === tier);
export const PRIMARY_KEYS = keysOf("primary");
export const SECONDARY_KEYS = keysOf("secondary");
