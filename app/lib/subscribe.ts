// Subscribe destinations: key -> { label, icon, tier }. Keys match show_config.subscribe_links.
// Primary apps get prominent placement (footer Listen column + buttons on /subscribe); secondary
// directories show under "More directories" on /subscribe. Both tiers stay in subscribe_links (and
// thus Organization/PodcastSeries sameAs). The Android/Email/RSS mechanisms are NOT here (they are
// feed redirects, not identity profiles) and live only on the /subscribe page.
import { Podcast, Music, Music2, Radio, Antenna, Disc3, Library, Star, type LucideIcon } from "lucide-react";

type SubTier = "primary" | "secondary";
export type SubDest = { label: string; tier: SubTier; icon: LucideIcon };

export const SUBSCRIBE_DESTINATIONS: Record<string, SubDest> = {
  apple: { label: "Apple Podcasts", tier: "primary", icon: Podcast },
  spotify: { label: "Spotify", tier: "primary", icon: Music },
  amazon: { label: "Amazon Music", tier: "primary", icon: Music2 },
  pandora: { label: "Pandora", tier: "primary", icon: Radio },
  tunein: { label: "TuneIn", tier: "primary", icon: Antenna },
  deezer: { label: "Deezer", tier: "secondary", icon: Disc3 },
  podcastindex: { label: "Podcast Index", tier: "secondary", icon: Library },
  podchaser: { label: "Podchaser", tier: "secondary", icon: Star },
};

export const PRIMARY_KEYS = ["apple", "spotify", "amazon", "pandora", "tunein"] as const;
export const SECONDARY_KEYS = ["deezer", "podcastindex", "podchaser"] as const;
