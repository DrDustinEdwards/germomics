// Streams game assets (sprites / sfx / wasm) from the GAME_ASSETS R2 bucket over the native
// binding. Path: /games/assets/* — Phaser scenes load from here. No HTTP to a
// Cloudflare service: reads go through env.GAME_ASSETS, not fetch().
import type { Route } from "./+types/games.assets.$";
import { getEnv } from "~/lib/context.server";
import { getGameAsset } from "~/lib/r2.server";

export async function loader({ params, context }: Route.LoaderArgs) {
  const key = params["*"];
  if (!key) throw new Response("Not found", { status: 404 });
  const object = await getGameAsset(getEnv(context), key);
  if (!object) throw new Response("Not found", { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
}
