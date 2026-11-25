// The single gate for the whole admin.* subtree, resource routes included: middleware runs once before any admin
// loader or action. It re-verifies Access's JWT and the roster (ADMIN_EMAIL, CO_OWNER_EMAILS; accessAdmin) and answers
// 403 otherwise, so a bypassed or misconfigured Access never reaches a route. A cross-site write is refused first
// (refuseCrossSite), since the framework's Origin check never sees a resource route. Every answer is private, no-store
// and noindex; each refusal writes one OWASP `authz_fail` line.
import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { Link } from "capsomer/react/link";
import {
  Icon,
  iconCut,
  iconFileAudio,
  iconMail,
  iconOverview,
  iconPeople,
  iconSettings,
} from "capsomer/react/icons";
import { AdminShell, type AdminEntry } from "capsomer/react/admin-shell";
import "~/admin.css";
import type { Route } from "./+types/admin";
import { getEnv } from "@dustinedwards/site-runtime/context";
import { accessAdmin } from "@dustinedwards/site-runtime/access";
import { OWASP_EVENTS, logEvent, requestFields } from "@dustinedwards/site-runtime/log";
import { isolationVerdict, refuseCrossSite } from "@dustinedwards/site-runtime/origin";
import { PRIVATE_PAGE_HEADERS, UNCACHED } from "@dustinedwards/site-runtime/edge-cache";
import { effectiveTheme, toggleTheme, type ThemeChoice } from "capsomer/behavior/theme-switch";
import { THEME_KEY } from "~/lib/theme";

const PRIVATE = { "Cache-Control": UNCACHED, "X-Robots-Tag": "noindex, nofollow" };

export const handle = { hydrate: true };

// no-transform keeps the Web Analytics beacon out of private pages (PRIVATE_PAGE_HEADERS).
export const headers = () => PRIVATE_PAGE_HEADERS;

export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    const refused = refuseCrossSite(request, PRIVATE);
    if (refused) {
      logRefusal(request, "cross-site", refused.status);
      throw refused;
    }
    // isolationVerdict: another site may link to an admin page and nothing more, never load it with the Access cookie.
    if (!isolationVerdict(request).ok) {
      logRefusal(request, "cross-site-resource", 403);
      throw new Response("Forbidden", { status: 403, headers: PRIVATE });
    }
    if (!(await accessAdmin(request, getEnv(context)))) {
      logRefusal(request, "not-admin", 403);
      throw new Response("Forbidden", { status: 403, headers: PRIVATE });
    }
    // A copy, since a redirect's headers are immutable.
    const response = await next();
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(PRIVATE)) headers.set(name, value);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
];

// No email or token in the line: the log scrubs any address.
function logRefusal(request: Request, reason: string, status: number) {
  logEvent(
    OWASP_EVENTS.authorizationFailure,
    { ...requestFields(request), reason, status },
    { level: "warn" },
  );
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const session = await accessAdmin(request, getEnv(context));
  return { email: session?.email ?? "" };
}

const icon = (d: string) => <Icon d={d} className="cap-admin-icon" />;

// `match` adds the prefixes that also mark an entry current.
const ENTRIES: AdminEntry[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/admin",
    group: "Overview",
    icon: icon(iconOverview),
  },
  {
    id: "episodes",
    label: "Episode audio",
    href: "/admin/episodes",
    group: "Content",
    icon: icon(iconFileAudio),
  },
  {
    id: "people",
    label: "People",
    href: "/admin/people",
    group: "Content",
    icon: icon(iconPeople),
  },
  {
    id: "soundbites",
    label: "Soundbites",
    href: "/admin/soundbites",
    group: "Content",
    icon: icon(iconCut),
  },
  {
    id: "subscribers",
    label: "Subscribers",
    href: "/admin/subscribers",
    group: "Audience",
    icon: icon(iconMail),
  },
  {
    id: "settings",
    label: "Settings",
    href: "/admin/settings",
    group: "Site",
    icon: icon(iconSettings),
    match: ["/admin/settings", "/admin/content"],
  },
];

// Capsomer's tokens key on data-cap-theme; follow the site's data-theme (or the system preference) so the admin agrees.
function useCapTheme(): ThemeChoice {
  const [theme, setTheme] = useState<ThemeChoice>("light");
  useEffect(() => {
    const sync = () => setTheme(effectiveTheme());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", sync);
    return () => {
      observer.disconnect();
      mq.removeEventListener("change", sync);
    };
  }, []);
  return theme;
}

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  const { pathname } = useLocation();
  const theme = useCapTheme();
  const email = loaderData.email;

  return (
    <div data-cap-theme={theme} suppressHydrationWarning style={{ display: "contents" }}>
      <AdminShell
        title="Germomics"
        apps={[
          { id: "germomics", label: "Germomics admin", href: "/admin", mono: "G", current: true },
        ]}
        nav={ENTRIES}
        pathname={pathname}
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
              onClick: () => toggleTheme(THEME_KEY),
            },
          ],
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
