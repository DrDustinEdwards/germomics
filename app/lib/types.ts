// Client-safe shared types. No server imports, so this is safe in browser bundles.
// db/schema.ts re-uses Chapter/Guest from here so the shapes never drift.

export type Chapter = { start: number; title: string; img?: string; url?: string };
export type Guest = { name: string; role?: string; bio?: string; link?: string; img?: string };

/** A reference/credit entry for the episode Sources block (also covers image credits, type:"image"). */
export type Source = {
  type: "credit" | "music" | "image" | "article" | "book" | "web" | string;
  title: string;
  url?: string;
  authors?: string;
  publisher?: string;
  note?: string;
  license?: string;
};

/** A curated, scannable "In this episode" moment. Distinct from player chapters; both seek the player. */
export type KeyMoment = { seconds: number; label: string };

/** A show host (show-level byline). Maps to <podcast:person> in the feed alongside per-episode guests. */
export type Host = { name: string; role?: string; img?: string; href?: string };

/** A labeled external link on a Person (website, social, etc.). */
export type PersonLink = { label: string; url: string };

/** An Apple Podcasts category with an optional subcategory (nested in the feed). */
export type PodcastCategory = { category: string; subcategory?: string };

/** A guest as rendered on an episode page — resolved from the people entities (or legacy JSON). */
export type GuestView = {
  name: string;
  slug: string;
  role?: string | null;
  bio?: string | null;
  photo?: string | null;
  photoAlt?: string | null;
  link?: string | null;
  links?: PersonLink[];
};

/** A soundbite as rendered by the public clip player. */
export type SoundbiteView = { id: number; start: number; duration: number; title: string | null };

export type Theme = "light" | "dark";

/** The minimal episode shape the persistent player needs. Built from loader data. */
export type PlayerTrack = {
  id: number;
  slug: string;
  title: string;
  audioUrl: string;
  durationSec: number | null;
  artwork: string | null;
  episodeNumber: number | null;
  chapters: Chapter[];
};
