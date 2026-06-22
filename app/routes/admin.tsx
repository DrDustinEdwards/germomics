// Admin layout — the SINGLE gate for the whole admin.* subtree. RR v8 middleware runs once
// per request before any admin loader/action, so the auth check is not repeated per route
// (per the v8_middleware instruction). /admin/login is a sibling route, not a child here, so
// it stays reachable when signed out (no redirect loop).
import { Outlet, redirect, Link, Form } from "react-router";
import { LayoutDashboard, FileAudio, LogOut, ExternalLink, Users, Settings } from "lucide-react";
import type { Route } from "./+types/admin";
import { getEnv } from "~/lib/context.server";
import { getAdminSession } from "~/lib/auth.server";

export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    const session = await getAdminSession(getEnv(context), request);
    if (!session) throw redirect("/admin/login");
    return next();
  },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = await getAdminSession(getEnv(context), request);
  return { email: session?.user.email ?? "" };
}

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <nav className="flex items-center gap-4 font-display text-sm">
            <Link to="/admin" className="flex items-center gap-1.5 font-semibold">
              <LayoutDashboard size={16} aria-hidden /> Admin
            </Link>
            <Link to="/admin/posts" className="flex items-center gap-1.5 text-muted hover:text-ink">
              <FileAudio size={16} aria-hidden /> Posts
            </Link>
            <Link to="/admin/people" className="flex items-center gap-1.5 text-muted hover:text-ink">
              <Users size={16} aria-hidden /> People
            </Link>
            <Link to="/admin/settings" className="flex items-center gap-1.5 text-muted hover:text-ink">
              <Settings size={16} aria-hidden /> Settings
            </Link>
          </nav>
          <div className="flex items-center gap-3 font-mono text-xs text-muted">
            <Link to="/" className="flex items-center gap-1 hover:text-ink">
              <ExternalLink size={13} aria-hidden /> site
            </Link>
            <span className="hidden sm:inline">{loaderData.email}</span>
            <Form method="post" action="/admin/logout">
              <button type="submit" className="flex items-center gap-1 hover:text-ink">
                <LogOut size={13} aria-hidden /> sign out
              </button>
            </Form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
