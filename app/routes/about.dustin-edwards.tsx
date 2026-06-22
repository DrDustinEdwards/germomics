// /about/dustin-edwards — author bio with credentials. Carries Person + BreadcrumbList JSON-LD
// (E-E-A-T author authority / entity clarity). Bio prose is grounded in confirmed facts; the
// "to confirm" items render as a clearly-marked editor note, not asserted as fact. Public, WCAG AA.
import { Link } from "react-router";
import { FlaskConical, GraduationCap, ArrowLeft, Info } from "lucide-react";
import type { Route } from "./+types/about.dustin-edwards";
import { getEnv } from "~/lib/context.server";
import { getShowConfig } from "~/lib/show.server";
import { buildPersonLd, buildBreadcrumbLd } from "~/lib/seo";
import { AUTHOR } from "~/lib/about";

export function meta({ loaderData }: Route.MetaArgs) {
  const origin = loaderData?.origin ?? "";
  const seriesTitle = loaderData?.seriesTitle ?? "germomics";
  const desc = AUTHOR.bio[0];
  const person = {
    ...AUTHOR,
    knowsAbout: [...AUTHOR.research, ...AUTHOR.teaching],
  };
  return [
    { title: `${AUTHOR.honorific} ${AUTHOR.name} — germomics` },
    { name: "description", content: desc },
    { property: "og:title", content: `${AUTHOR.honorific} ${AUTHOR.name}` },
    { property: "og:description", content: desc },
    { property: "og:type", content: "profile" },
    { property: "og:url", content: `${origin}/about/${AUTHOR.slug}` },
    { "script:ld+json": buildPersonLd(person, origin, AUTHOR.slug, seriesTitle) },
    {
      "script:ld+json": buildBreadcrumbLd([
        { name: "Home", url: `${origin}/` },
        { name: "About", url: `${origin}/about` },
        { name: AUTHOR.name, url: `${origin}/about/${AUTHOR.slug}` },
      ]),
    },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const show = await getShowConfig(getEnv(context));
  return { origin: new URL(request.url).origin, seriesTitle: show.title };
}

export default function AuthorBio() {
  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to="/about"
        className="inline-flex items-center gap-1 font-mono text-xs text-muted hover:text-ink"
      >
        <ArrowLeft size={12} aria-hidden /> About
      </Link>

      <p className="mt-4 font-mono text-xs uppercase tracking-[0.18em] text-accent">Author</p>
      <h1 className="mt-3 font-display text-4xl font-semibold leading-tight">
        {AUTHOR.honorific} {AUTHOR.name}
      </h1>
      <p className="mt-2 font-mono text-sm text-muted">{AUTHOR.role}</p>

      <div className="mt-6 space-y-4 leading-relaxed">
        {AUTHOR.bio.map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
            <FlaskConical size={16} aria-hidden /> Research
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {AUTHOR.research.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="flex items-center gap-2 font-display text-sm font-semibold">
            <GraduationCap size={16} aria-hidden /> Teaching
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {AUTHOR.teaching.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      </div>

      {/* Clearly-marked editor note — placeholders for Dustin to confirm. Not Person-schema facts. */}
      <aside className="mt-8 rounded-xl border border-dashed border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
        <p className="flex items-center gap-2 font-display font-semibold">
          <Info size={15} aria-hidden /> To confirm before launch
        </p>
        <p className="mt-1 text-muted">
          Placeholders for {AUTHOR.name} to verify and fill in:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          {AUTHOR.toConfirm.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </aside>

      <p className="mt-8">
        <Link to="/episodes" className="font-mono text-sm text-accent hover:underline">
          Listen to germomics →
        </Link>
      </p>
    </div>
  );
}
