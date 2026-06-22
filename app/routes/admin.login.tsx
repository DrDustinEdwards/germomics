// Standalone (NOT under the admin layout) so it stays reachable when signed out. If the admin
// is already signed in, bounce to the dashboard.
import { useState } from "react";
import { redirect } from "react-router";
import type { Route } from "./+types/admin.login";
import { getEnv } from "~/lib/context.server";
import { getAdminSession } from "~/lib/auth.server";
import { signIn } from "~/lib/auth-client";

export function meta() {
  return [{ title: "Sign in · germomics admin" }, { name: "robots", content: "noindex" }];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  if (await getAdminSession(getEnv(context), request)) throw redirect("/admin");
  return null;
}

export default function AdminLogin() {
  const [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto max-w-sm py-16 text-center">
      <h1 className="font-display text-2xl font-semibold">germomics admin</h1>
      <p className="mt-2 text-sm text-muted">Single-administrator access.</p>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void signIn.social({ provider: "google", callbackURL: "/admin" });
        }}
        className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 font-display text-sm hover:border-brand disabled:opacity-60"
      >
        {busy ? "Redirecting…" : "Continue with Google"}
      </button>
    </div>
  );
}
