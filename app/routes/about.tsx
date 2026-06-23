// /about - what germomics is, who makes it, how to follow it. Prose comes from the page:about and
// page:dustin-edwards content blocks (D1, editable); Organization + BreadcrumbList JSON-LD carry
// entity clarity. Public, WCAG AA. ?preview shows drafts to a signed-in admin.
import { Link } from "react-router";
import { Rss, Mic, FileText, Database, Gamepad2, User } from "lucide-react";
import type { Route } from "./+types/about";
import { getEnv, getSettings } from "~/lib/context.server";
import { getShowConfig } from "~/lib/show.server";
import { loadPage, isPreviewing, settingAddress } from "~/lib/content.server";
import { buildOrganizationLd, buildBreadcrumbLd, stripHtml } from "~/lib/seo";
import { BodyRenderer } from "~/components/content/BodyRenderer";
import { AUTHOR } from "~/lib/about";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "About germomics" }];
  const { origin, show, address, title, description } = loaderData;
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: `${origin}/about` },
    { "script:ld+json": buildOrganizationLd(show, origin, { address }) },
    {
      "script:ld+json": buildBreadcrumbLd([
        { name: "Home", url: `${origin}/` },
        { name: "About", url: `${origin}/about` },
      ]),
    },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const preview = await isPreviewing(env, request);
  const [about, bio, show] = await Promise.all([
    loadPage(env, "page:about", { includeDrafts: preview }),
    loadPage(env, "page:dustin-edwards", { includeDrafts: preview }),
    getShowConfig(env),
  ]);
  return {
    origin: new URL(request.url).origin,
    show,
    address: settingAddress(getSettings(context)),
    title: about.title || "About germomics",
    description: stripHtml(about.value).slice(0, 160),
    aboutHtml: about.value,
    bioHtml: bio.value,
  };
}

const EXPLORE = [
  { to: "/episodes", icon: Mic, label: "Episodes", note: "Listen, with transcripts and chapters." },
  { to: "/writing", icon: FileText, label: "Writing", note: "Essays and notes." },
  { to: "/data", icon: Database, label: "Data", note: "Interactive virus and bacteria pages." },
  { to: "/games", icon: Gamepad2, label: "Games", note: "Short browser games." },
];

export default function About({ loaderData }: Route.ComponentProps) {
  const { title, aboutHtml, bioHtml } = loaderData;
  return (
    <div className="mx-auto max-w-2xl">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">About</p>
      <h1 className="mt-3 font-display text-4xl font-semibold leading-tight">{title}</h1>
      <div className="prose-legal mt-4">
        <BodyRenderer html={aboutHtml} />
      </div>

      <section className="mt-10 rounded-2xl border border-border bg-surface p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <User size={18} aria-hidden /> The author
        </h2>
        <div className="prose-legal mt-2">
          <BodyRenderer html={bioHtml} />
        </div>
        <Link
          to={`/about/${AUTHOR.slug}`}
          className="mt-3 inline-flex items-center gap-1 font-mono text-sm text-accent hover:underline"
        >
          More about {AUTHOR.name} →
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
