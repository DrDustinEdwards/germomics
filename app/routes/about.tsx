// /about — what germomics is, who makes it, how to follow it. Carries Organization +
// BreadcrumbList JSON-LD (entity clarity for search + AI). Public, WCAG AA.
import { Link } from "react-router";
import { Rss, Mic, FileText, Database, Gamepad2, User } from "lucide-react";
import type { Route } from "./+types/about";
import { getEnv } from "~/lib/context.server";
import { getShowConfig } from "~/lib/show.server";
import { buildOrganizationLd, buildBreadcrumbLd } from "~/lib/seo";
import { ABOUT, AUTHOR } from "~/lib/about";

export function meta({ loaderData }: Route.MetaArgs) {
  const origin = loaderData?.origin ?? "";
  const show = loaderData?.show;
  return [
    { title: `${ABOUT.title} — germomics` },
    { name: "description", content: ABOUT.lede },
    { property: "og:title", content: ABOUT.title },
    { property: "og:description", content: ABOUT.lede },
    { property: "og:url", content: `${origin}/about` },
    ...(show ? [{ "script:ld+json": buildOrganizationLd(show, origin) }] : []),
    {
      "script:ld+json": buildBreadcrumbLd([
        { name: "Home", url: `${origin}/` },
        { name: "About", url: `${origin}/about` },
      ]),
    },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const show = await getShowConfig(getEnv(context));
  return { origin: new URL(request.url).origin, show };
}

const EXPLORE = [
  { to: "/episodes", icon: Mic, label: "Episodes", note: "Listen, with transcripts and chapters." },
  { to: "/writing", icon: FileText, label: "Writing", note: "Essays and notes." },
  { to: "/data", icon: Database, label: "Data", note: "Interactive virus & bacteria pages." },
  { to: "/games", icon: Gamepad2, label: "Games", note: "Short browser games." },
];

export default function About() {
  return (
    <div className="mx-auto max-w-2xl">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">About</p>
      <h1 className="mt-3 font-display text-4xl font-semibold leading-tight">{ABOUT.title}</h1>
      <p className="mt-4 text-lg text-muted">{ABOUT.lede}</p>

      <div className="mt-6 space-y-4 leading-relaxed">
        {ABOUT.paragraphs.map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
      </div>

      <section className="mt-10 rounded-2xl border border-border bg-surface p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <User size={18} aria-hidden /> The author
        </h2>
        <p className="mt-2 text-muted">
          {AUTHOR.honorific} {AUTHOR.name} is a {AUTHOR.role.toLowerCase()} and the host of germomics.
        </p>
        <Link
          to={`/about/${AUTHOR.slug}`}
          className="mt-3 inline-flex items-center gap-1 font-mono text-sm text-accent hover:underline"
        >
          Read {AUTHOR.name}’s bio →
        </Link>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 font-display text-xl font-semibold">Explore</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {EXPLORE.map(({ to, icon: Icon, label, note }) => (
            <li key={to}>
              <Link
                to={to}
                className="flex h-full flex-col rounded-xl border border-border bg-card p-4 hover:border-brand"
              >
                <span className="flex items-center gap-2 font-display font-medium">
                  <Icon size={16} aria-hidden /> {label}
                </span>
                <span className="mt-1 text-sm text-muted">{note}</span>
              </Link>
            </li>
          ))}
        </ul>
        <a
          href="/feed/podcast/"
          className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 font-mono text-sm hover:border-accent hover:text-accent"
        >
          <Rss size={15} aria-hidden /> Podcast RSS
        </a>
      </section>
    </div>
  );
}
