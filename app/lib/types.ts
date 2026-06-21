// Client-safe shared types. No server imports, so this is safe in browser bundles.
// db/schema.ts re-uses Chapter/Guest from here so the shapes never drift.

export type Chapter = { start: number; title: string; img?: string; url?: string };
export type Guest = { name: string; role?: string; bio?: string; link?: string; img?: string };

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
