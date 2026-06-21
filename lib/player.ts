// lib/player.ts the shape the persistent player consumes, decoupled from the DB row.

import type { Post, Chapter } from '@/db/schema';
import { postHref } from '@/lib/posts';

export type Track = {
  id: number;
  title: string;
  href: string;
  audioUrl: string;
  duration: number | null;
  artwork: string | null;
  chapters: Chapter[] | null;
};

/** Map a published episode row to a player Track. Returns null for items without audio. */
export function postToTrack(p: Post): Track | null {
  if (p.kind !== 'episode' || !p.audioUrl) return null;
  return {
    id: p.id,
    title: p.title,
    href: postHref(p),
    audioUrl: p.audioUrl,
    duration: p.audioDuration ?? null,
    artwork: p.episodeArtwork ?? p.coverImage ?? null,
    chapters: p.chapters ?? null,
  };
}

export function tracksFrom(posts: Post[]): Track[] {
  return posts.map(postToTrack).filter((t): t is Track => t !== null);
}

export const SPEEDS = [0.8, 1, 1.25, 1.5, 1.75, 2] as const;
