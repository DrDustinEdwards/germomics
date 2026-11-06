// The operator API's media delete: removes library pictures through site-api's own mediaLibrary, so the same checks
// Carrel's delete runs apply here. A picture a post, an episode or the show still uses is refused (naming each use),
// and a deleted file's last bytes go to history (BACKUPS media/revisions/), so a mistake can be reverted from Carrel.
import { MediaInUseError, NotFoundError, RefusedError, describeUses } from "@dustinedwards/site-api";
import { logEvent } from "@dustinedwards/site-runtime/log";
import { carrelMedia } from "~/lib/carrel/media.server";

export const MAX_DELETE_KEYS = 25;

export type DeleteMediaResult = {
  deleted: string[];
  refused: Array<{ key: string; reason: string }>;
  missing: string[];
};

/** The keys asked for, or a message saying what is wrong with the request. */
export function keysFrom(args: unknown): { keys: string[] } | { error: string } {
  const asked = (args as { keys?: unknown } | null)?.keys;
  if (!Array.isArray(asked) || asked.length === 0 || asked.some((k) => typeof k !== "string" || k === "")) {
    return { error: "delete_media takes `keys`: a list of 1 to 25 library keys, such as \"episode-1/photo-795.webp\"." };
  }
  const keys = [...new Set(asked as string[])];
  if (keys.length > MAX_DELETE_KEYS) return { error: `delete_media takes at most ${MAX_DELETE_KEYS} keys a call.` };
  return { keys };
}

export async function deleteMedia(env: Env, keys: string[]): Promise<DeleteMediaResult> {
  const result: DeleteMediaResult = { deleted: [], refused: [], missing: [] };
  const batch = crypto.randomUUID();
  const media = carrelMedia(env, (event, id, version, changeId) => logEvent("operator_media", { event, id, version, changeId }));
  for (const [n, key] of keys.entries()) {
    try {
      await media.delete(key, { changeId: `operator-delete-${batch}-${n}` });
      result.deleted.push(key);
    } catch (error) {
      if (error instanceof NotFoundError) result.missing.push(key);
      else if (error instanceof MediaInUseError) result.refused.push({ key, reason: `in use: ${describeUses(error.usedBy)}` });
      else if (error instanceof RefusedError) result.refused.push({ key, reason: error.message });
      else throw error;
    }
  }
  return result;
}
