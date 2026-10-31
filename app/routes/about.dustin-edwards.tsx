// /about/dustin-edwards - author bio. Prose comes from the page:dustin-edwards content block (D1).
// Person JSON-LD carries author authority. Independent framing: credentials in the
// prose only, no institutional branding. ?preview shows the draft to a signed-in admin.
import { Link } from "capsomer/react/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Route } from "./+types/about.dustin-edwards";
import { getEnv } from "~/lib/context.server";
import { loadPage, isPreviewing } from "~/lib/content.server";
import { jsonLd } from "@drdustinedwards/site-helpers/schema";
import { buildPersonLd, pageHead, stripHtml } from "~/lib/seo";
import { BodyRenderer } from "~/components/content/BodyRenderer";
import { AUTHOR } from "~/lib/about";

const LINKS = [
  { label: "Faculty profile", url: "https://faculty.tarleton.edu/dcedwards/" },
  { label: "Personal site", url: "https://dustinedwards.info" },
];

export function meta({ loaderData }: Route.MetaArgs) {
  const bioText = loaderData?.bioText ?? AUTHOR.bio;
  return [
    ...pageHead({
      path: `/about/${AUTHOR.slug}`,
      title: `${AUTHOR.honorific} ${AUTHOR.name}`,
      description: bioText,
      type: "profile",
    }),
    jsonLd(buildPersonLd({ ...AUTHOR, bio: bioText })),
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const preview = await isPreviewing(env, request);
  const bio = await loadPage(env, "page:dustin-edwards", { includeDrafts: preview });
  return { bioHtml: bio.value, bioText: stripHtml(bio.value) };
}

export default function AuthorBio({ loaderData }: Route.ComponentProps) {
  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/about" className="inline-flex items-center gap-1 font-mono text-xs text-muted hover:text-ink">
        <ArrowLeft size={12} aria-hidden /> About
      </Link>

      <p className="mt-4 font-mono text-xs uppercase tracking-[0.18em] text-accent">Author</p>
      <h1 className="mt-3 font-display text-4xl font-semibold leading-tight">
        {AUTHOR.honorific} {AUTHOR.name}
      </h1>
      <p className="mt-2 font-mono text-sm text-muted">{AUTHOR.jobTitle}</p>

      <div className="prose-legal mt-6">
        <BodyRenderer html={loaderData.bioHtml} />
      </div>

      <section className="mt-8">
        <h2 className="mb-2 font-display text-sm font-semibold">Find Dr. Edwards online</h2>
        <ul className="flex flex-wrap gap-3 font-mono text-sm">
          {LINKS.map((l) => (
            <li key={l.url}>
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 hover:border-accent hover:text-accent"
              >
                <ExternalLink size={13} aria-hidden /> {l.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-8">
        <Link to="/episodes" className="font-mono text-sm text-accent hover:underline">
          Listen to Germomics →
        </Link>
      </p>
    </div>
  );
}
