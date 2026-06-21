// Better Auth catch-all — mounts the whole /api/auth/* surface (sign-in, callback, session,
// sign-out). Both loader and action hand the request to auth.handler. Resource route: no
// component. The auth instance is built per-request from the native env (CLAUDE.md rule #1).
import type { Route } from "./+types/api.auth.$";
import { createAuth } from "~/lib/auth.server";
import { getEnv } from "~/lib/context.server";

export async function loader({ request, context }: Route.LoaderArgs) {
  return createAuth(getEnv(context)).handler(request);
}

export async function action({ request, context }: Route.ActionArgs) {
  return createAuth(getEnv(context)).handler(request);
}
