// POST /admin/logout — signs out via Better Auth (clearing the KV session + cookie) and
// redirects to the login screen. asResponse gives us the Set-Cookie to forward.
import { redirect } from "react-router";
import type { Route } from "./+types/admin.logout";
import { getEnv } from "~/lib/context.server";
import { createAuth } from "~/lib/auth.server";

export async function action({ request, context }: Route.ActionArgs) {
  const auth = createAuth(getEnv(context));
  const res = await auth.api.signOut({ headers: request.headers, asResponse: true });
  const headers = new Headers(res.headers);
  headers.set("Location", "/admin/login");
  return new Response(null, { status: 303, headers });
}

export async function loader() {
  throw redirect("/admin");
}
