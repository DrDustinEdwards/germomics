// Resource loader for a single version snapshot — used by the editor's version-history diff.
// Child of the admin.* gate (admin.tsx middleware), so it is never publicly readable.
import type { Route } from "./+types/admin.version.$vid";
import { getEnv } from "~/lib/context.server";
import { getVersion } from "~/lib/admin.server";

export async function loader({ params, context }: Route.LoaderArgs) {
  const snapshot = await getVersion(getEnv(context), Number(params.vid));
  if (!snapshot) throw new Response("Not found", { status: 404 });
  return { snapshot };
}
