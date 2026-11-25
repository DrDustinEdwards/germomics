import { useEffect, useEffectEvent, useRef, useState } from "react";
import type Phaser from "phaser";
import { createPhageDefense, type GameEvents } from "./phage-defense";

// Lazy() target — keeps Phaser off every other route. Maps a game slug to its scene factory.
const FACTORIES: Record<string, (parent: HTMLElement, events: GameEvents) => Phaser.Game> = {
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
  // The canvas draws the running score; this is its text, read out politely as it changes.
  const [running, setRunning] = useState(0);
  const gameOver = useEffectEvent((s: number) => onScore(s));

  useEffect(() => {
    const factory = FACTORIES[slug];
    if (!ref.current || !factory) return;
    setRunning(0);
    const game = factory(ref.current, { onScore: setRunning, onGameOver: (s) => gameOver(s) });
    return () => game.destroy(true);
  }, [slug]);

  return (
    <>
      <div ref={ref} className="gm-game-frame" role="application" aria-label="Phage Defense game" />
      <p className="cap-sr-only" aria-live="polite" aria-atomic="true">
        Score {running}
      </p>
    </>
  );
}
