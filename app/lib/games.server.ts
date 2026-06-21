// Game catalog (bundled, like the dataset catalog). Each game ships its own Phaser scene,
// loaded only on its /games/:slug route. Assets live in the GAME_ASSETS R2 bucket and are
// served via /games/assets/* — see routes/games.assets.$.ts.
export type GameMeta = {
  slug: string;
  title: string;
  tagline: string;
  instructions: string;
};

const GAMES: Record<string, GameMeta> = {
  "phage-defense": {
    slug: "phage-defense",
    title: "Phage Defense",
    tagline: "Hold the line against the bacterial tide.",
    instructions:
      "Move with ← → (or A / D). Press Space or click to launch a phage. Destroy bacteria before any reach the base. One breach ends the run.",
  },
};

export function listGames(): GameMeta[] {
  return Object.values(GAMES);
}

export function getGame(slug: string): GameMeta | null {
  return GAMES[slug] ?? null;
}
