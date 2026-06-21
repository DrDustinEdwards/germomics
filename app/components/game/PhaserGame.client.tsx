import { useEffect, useRef } from "react";
import type Phaser from "phaser";
import { createPhageDefense } from "./phage-defense";

// Lazy() target — keeps Phaser off every other route. Maps a game slug to its scene factory.
const FACTORIES: Record<string, (parent: HTMLElement, onScore: (s: number) => void) => Phaser.Game> = {
  "phage-defense": createPhageDefense,
};

export default function PhaserGame({
  slug,
  onScore,
}: {
  slug: string;
  onScore: (score: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const cb = useRef(onScore);
  cb.current = onScore;

  useEffect(() => {
    const factory = FACTORIES[slug];
    if (!ref.current || !factory) return;
    const game = factory(ref.current, (s) => cb.current(s));
    return () => game.destroy(true);
  }, [slug]);

  return <div ref={ref} className="mx-auto w-full max-w-[800px] overflow-hidden rounded-xl border border-border" />;
}
