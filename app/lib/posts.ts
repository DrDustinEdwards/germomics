// Client-safe pure helpers (no env, no DB) shared by loaders AND components. Kept out of
// posts.server so components can import them without pulling a .server module into the client
// bundle (the React Router dot-server boundary).
import type { Post } from "~/db/schema";
import type { PlayerTrack } from "~/lib/types";

export function slugifyGuest(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/** Map a published episode to the minimal shape the player consumes. */
export function toPlayerTrack(p: Post): PlayerTrack {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    audioUrl: p.audioUrl ?? "",
    durationSec: p.audioDuration ?? null,
    artwork: p.episodeArtwork ?? p.coverImage ?? null,
    episodeNumber: p.episodeNumber ?? null,
    chapters: p.chapters ?? [],
  };
}
