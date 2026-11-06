// POST /api/operator: the operator API, the one door the admin MCP Worker (mcp/) reaches the site through, over a
// service binding. One POST taking `{ tool, args }`, so an MCP front end maps onto it; GET with the same bearer lists
// the tools. The bearer is the whole boundary: OPERATOR_TOKEN, compared in constant time and never echoed or logged.
// Unset or short closes the route. This is not under /admin, so Access does not cover it.
//
// Tools: backup_media, the files backup passes (app/lib/backup.server.ts) run now (copy only, so safe to repeat),
// backup_status, the backup state read now (the same read as /health's backup field, which /health keeps for an hour),
// and delete_media, which removes library pictures through the library's own delete (app/lib/operator-media.server.ts).
import { safeEqual } from "@dustinedwards/site-runtime/compare";
import { OWASP_EVENTS, logEvent, requestFields } from "@dustinedwards/site-runtime/log";
import { limit, limitedResponse, mustStop } from "@dustinedwards/site-runtime/rate-limit";
import type { Route } from "./+types/api.operator";
import { backupFilesNow, backupStatus } from "~/lib/backup.server";
import { getEnv } from "~/lib/context.server";
import { readJson } from "~/lib/body.server";
import { deleteMedia, keysFrom } from "~/lib/operator-media.server";

const MIN_TOKEN_LENGTH = 32;
const OPERATOR_BODY = 8 * 1024;

export const TOOLS = {
  backup_media: {
    description:
      "Runs the nightly files backup now: one pass each over the audio, the images and the game assets into the backups bucket " +
      "(files/audio/, files/images/ and files/game-assets/). Copy only; each pass goes on where its last stopped.",
  },
  backup_status: {
    description:
      "Reads the backup state now, uncached: the newest complete D1 dump's age and each files pass (audio, images, game assets) " +
      "with when it last completed, and a warning when any is past 26 hours. The same read as /health's backup field.",
  },
  delete_media: {
    description:
      "Deletes library pictures by key (1 to 25 a call), through the same delete Carrel runs: a picture a post, an episode " +
      "or the show still uses is refused and named, and a deleted file's last bytes are kept in history, so Carrel can revert it. " +
      "Answers which keys were deleted, refused (with the reason) or not found.",
  },
} as const;
type ToolName = keyof typeof TOOLS;
const isToolName = (name: unknown): name is ToolName => typeof name === "string" && Object.hasOwn(TOOLS, name);

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex, nofollow", ...headers },
  });

// Authenticate first, so an anonymous flood never spends the operator's allowance.
async function refusal(env: Env, request: Request): Promise<Response | null> {
  const configured = env.OPERATOR_TOKEN;
  if (!configured || configured.length < MIN_TOKEN_LENGTH) {
    return json({ ok: false, error: "The operator API is not configured on this deployment." }, 503);
  }
  const presented = /^Bearer\s+(.+)$/i.exec((request.headers.get("authorization") ?? "").trim())?.[1] ?? "";
  // Refused on length before the hash, which an anonymous caller could otherwise ask for in any size.
  if (presented.length > configured.length * 2 || !(await safeEqual(presented, configured))) {
    logEvent(OWASP_EVENTS.signInFailure, { ...requestFields(request), via: "operator-bearer" }, { level: "warn" });
    return json({ ok: false, error: "Invalid or missing bearer token." }, 401);
  }
  return null;
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const refused = await refusal(getEnv(context), request);
  if (refused) return refused;
  return json({ ok: true, data: { tools: Object.entries(TOOLS).map(([name, t]) => ({ name, ...t })) } });
}

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") return json({ ok: false, error: "Use POST." }, 405, { allow: "GET, POST" });
  const env = getEnv(context);
  const refused = await refusal(env, request);
  if (refused) return refused;

  const verdict = await limit(env.RATE_LIMITER, "operator", [{ limit: 30, windowSeconds: 60 }], { onUnavailable: "refuse" });
  if (mustStop(verdict, "refuse")) {
    logEvent(OWASP_EVENTS.rateLimitExceeded, { ...requestFields(request, { status: 429 }), via: "operator" }, { level: "warn" });
    return limitedResponse(verdict);
  }

  const body = await readJson(request, OPERATOR_BODY).catch(() => null);
  const tool = (body as { tool?: unknown } | null)?.tool;
  if (!isToolName(tool)) return json({ ok: false, error: `Unknown tool. Available: ${Object.keys(TOOLS).join(", ")}.` }, 400);

  try {
    if (tool === "backup_status") return json({ ok: true, data: await backupStatus(env) });
    if (tool === "delete_media") {
      const asked = keysFrom((body as { args?: unknown }).args);
      if ("error" in asked) return json({ ok: false, error: asked.error }, 400);
      return json({ ok: true, data: await deleteMedia(env, asked.keys) });
    }
    return json({ ok: true, data: { files: await backupFilesNow(env) } });
  } catch (error) {
    logEvent("operator_tool_failed", { ...requestFields(request), tool, error }, { level: "error" });
    return json({ ok: false, error: error instanceof Error ? error.message : "The tool failed." }, 500);
  }
}
