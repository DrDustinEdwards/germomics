// Client-safe pure helpers (no env, no DB) shared by loaders AND components. Kept out of
// posts.server so components can import them without pulling a .server module into the client
// bundle (the React Router dot-server boundary).
import type { Post } from "~/db/schema";
import type { PlayerTrack } from "~/lib/types";

/** Map a published episode to the track Capsomer's player plays: its page, its transcript and its artwork. */
export function toPlayerTrack(p: Post): PlayerTrack {
  return {
    id: p.id,
    title: p.title,
    src: p.audioUrl ?? "",
    duration: p.audioDuration ?? undefined,
    artwork: p.episodeArtwork ?? p.coverImage ?? undefined,
    chapters: p.chapters ?? [],
    album: p.episodeNumber ? `Episode ${p.episodeNumber}` : "Germomics",
    href: `/${p.slug}`,
    transcript: `/${p.slug}#transcript`,
  };
}
