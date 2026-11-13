// Streams game assets (sprites / sfx / wasm) from the GAME_ASSETS R2 bucket over the native
// binding. Path: /games/assets/* — Phaser scenes load from here. No HTTP to a
// Cloudflare service: reads go through env.GAME_ASSETS, not fetch().
import type { Route } from "./+types/games.assets.$";
import { getEnv } from "@dustinedwards/site-runtime/context";
import { r2ObjectResponse } from "@dustinedwards/site-runtime/r2-object";

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const key = params["*"];
  if (!key) throw new Response("Not found", { status: 404 });
  return r2ObjectResponse(request, getEnv(context).GAME_ASSETS, key, {
    cacheControl: "public, max-age=31536000, immutable",
  });
}
