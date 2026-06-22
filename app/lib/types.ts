// Client-safe shared types. No server imports, so this is safe in browser bundles.
// db/schema.ts re-uses Chapter/Guest from here so the shapes never drift.

export type Chapter = { start: number; title: string; img?: string; url?: string };
export type Guest = { name: string; role?: string; bio?: string; link?: string; img?: string };

/** A labelled external link on a Person (website, social, etc.). */
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
