// The admin list, hashed with a fresh salt, for the daily Access drift check (.github/workflows/access-drift.yml).
// Under /admin so the germomics-login Access application covers it, but outside the admin layout, because the caller
// is that application's service token and not a person. site-runtime's adminListResponse answers only a GET carrying
// a verified Access token of a service token, and 404 to everything else. The list is ADMIN_EMAIL, the one the admin
// layout checks (adminEmails reads it), so GitHub holds no copy of it.
import type { Route } from "./+types/admin.access-drift";
import { getEnv } from "~/lib/context.server";
import { adminEmails } from "@dustinedwards/site-runtime/access";
import { adminListResponse } from "@dustinedwards/site-runtime/access-drift";

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  return adminListResponse(request, env, { admins: adminEmails(env) });
}
