// Admin layout: the SINGLE gate for the whole admin.* subtree. RR v8 middleware runs once
// per request before any admin loader/action, so the auth check is not repeated per route
// (per the v8_middleware instruction). Cloudflare Access signs people in before a request gets
// here; this re-verifies its JWT (app/lib/access.server.ts) and answers 403 to anything else, so
// a request that bypassed Access, or an Access setup that is wrong, never reaches an admin route.
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { Link } from "capsomer/react/link";
import { LayoutDashboard, FileAudio, Users, Settings, Mail, Scissors } from "lucide-react";
import { AdminShell, type AdminEntry } from "capsomer/react/admin-shell";
import "~/admin.css";
import type { Route } from "./+types/admin";
import { getEnv } from "~/lib/context.server";
import { getAdminSession } from "~/lib/access.server";
import { applyTheme, effectiveTheme } from "~/lib/theme";
import type { Theme } from "~/lib/types";

export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    const session = await getAdminSession(getEnv(context), request);
    if (!session) throw new Response("Forbidden", { status: 403 });
    return next();
  },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = await getAdminSession(getEnv(context), request);
  return { email: session?.email ?? "" };
}

const icon = (Icon: typeof LayoutDashboard) => <Icon className="cap-admin-icon" aria-hidden />;

// The admin's pages, grouped as the menu shows them. `match` decides which entry is current.
const ENTRIES: Array<AdminEntry & { match: (path: string) => boolean }> = [
  { id: "dashboard", label: "Dashboard", href: "/admin", group: "Overview", icon: icon(LayoutDashboard), match: (p) => p === "/admin" },
  { id: "posts", label: "Posts", href: "/admin/posts", group: "Content", icon: icon(FileAudio), match: (p) => p.startsWith("/admin/posts") },
  { id: "people", label: "People", href: "/admin/people", group: "Content", icon: icon(Users), match: (p) => p.startsWith("/admin/people") },
  { id: "soundbites", label: "Soundbites", href: "/admin/soundbites", group: "Content", icon: icon(Scissors), match: (p) => p.startsWith("/admin/soundbites") },
  { id: "subscribers", label: "Subscribers", href: "/admin/subscribers", group: "Audience", icon: icon(Mail), match: (p) => p.startsWith("/admin/subscribers") },
  { id: "settings", label: "Settings", href: "/admin/settings", group: "Site", icon: icon(Settings), match: (p) => p.startsWith("/admin/settings") || p.startsWith("/admin/content") },
];

// Capsomer's tokens are keyed on data-cap-theme; the site's own switch is data-theme on <html>
// (or the system preference when none is set). Follow it, so the admin never disagrees with it.
function useCapTheme(): Theme {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    const sync = () => setTheme(effectiveTheme());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", sync);
    return () => {
      observer.disconnect();
      mq.removeEventListener("change", sync);
    };
  }, []);
  return theme;
}

// Sets the theme before first paint, from the same storage the site's own script reads, so the
// server-rendered shell does not flash the wrong palette.
const THEME_BOOT = `(function(s){try{var t=localStorage.getItem("germomics-theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";s.parentElement.setAttribute("data-cap-theme",t);}catch(e){}})(document.currentScript)`;

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  const { pathname } = useLocation();
  const theme = useCapTheme();
  const nav = ENTRIES.map(({ match, ...entry }) => ({ ...entry, current: match(pathname) }));
  const email = loaderData.email;

  return (
    <div data-cap-theme={theme} data-cap-site="germomics" suppressHydrationWarning style={{ display: "contents" }}>
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      <AdminShell
        title="Germomics"
        apps={[{ id: "germomics", label: "Germomics admin", href: "/admin", mono: "G", current: true }]}
        nav={nav}
        renderLink={({ href, children, ...rest }) => (
          <Link to={href} {...rest}>
            {children}
          </Link>
        )}
        account={{
          name: email || "Administrator",
          initials: (email[0] ?? "A").toUpperCase(),
          role: "Administrator",
          email,
          appLinks: [
            { label: "View site", href: "/" },
            {
              label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
              onClick: () => applyTheme(theme === "dark" ? "light" : "dark"),
            },
          ],
          // Access owns sign-out: it ends the Access session, then returns to its own login.
          onSignOut: () => {
            window.location.href = "/cdn-cgi/access/logout";
          },
        }}
      >
        <div className="mx-auto max-w-5xl px-4 py-6">
          <Outlet />
        </div>
      </AdminShell>
    </div>
  );
}
