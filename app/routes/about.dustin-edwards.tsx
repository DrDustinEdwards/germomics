// /about/dustin-edwards - author bio. Prose comes from the page:dustin-edwards content block (D1).
// Person JSON-LD carries author authority. Independent framing: credentials in the
// prose only, no institutional branding. ?preview shows the draft to a signed-in admin.
import { htmlToText } from "@drdustinedwards/site-helpers/text";
import { Link } from "capsomer/react/link";
import { ExternalLink } from "lucide-react";
import type { Route } from "./+types/about.dustin-edwards";
import { getEnv } from "@dustinedwards/site-runtime/context";
import { loadPage, isPreviewing } from "~/lib/content.server";
import { jsonLd } from "@drdustinedwards/site-helpers/schema";
import { buildPersonLd, pageHead } from "~/lib/seo";
import { BodyRenderer } from "~/components/content/BodyRenderer";
import { AUTHOR } from "~/lib/about";
import { sectionPageTrail } from "~/lib/trails";
import { SectionTrail } from "~/components/content/SectionTrail";

const authorTrail = sectionPageTrail(
  { name: "About", path: "/about" },
  { name: `${AUTHOR.honorific} ${AUTHOR.name}`, path: `/about/${AUTHOR.slug}` },
);

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
      breadcrumbs: authorTrail,
    }),
    jsonLd(buildPersonLd({ ...AUTHOR, bio: bioText })),
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const preview = await isPreviewing(env, request);
  const bio = await loadPage(env, "page:dustin-edwards", { includeDrafts: preview });
  return { bioHtml: bio.html, bioText: htmlToText(bio.html) };
}

export default function AuthorBio({ loaderData }: Route.ComponentProps) {
  return (
    <div className="gm-narrow">
      <SectionTrail trail={authorTrail} />

      <p className="gm-eyebrow">Author</p>
      <h1 className="gm-eyebrow-title">
        {AUTHOR.honorific} {AUTHOR.name}
      </h1>
      <p className="gm-bio-meta">{AUTHOR.jobTitle}</p>

      <div data-context="prose" className="gm-bio-body">
        <BodyRenderer html={loaderData.bioHtml} />
      </div>

      <section className="gm-bio-section">
        <h2 className="gm-bio-section-title">Find Dr. Edwards online</h2>
        <ul className="gm-bio-links">
          {LINKS.map((l) => (
            <li key={l.url}>
              <a href={l.url} className="gm-bio-link">
                <ExternalLink size={13} aria-hidden /> {l.label}
              </a>
            </li>
          ))}
        </ul>
      </section>

      <p className="gm-bio-section">
        <Link to="/episodes" className="gm-bio-back">
          Listen to Germomics →
        </Link>
      </p>
    </div>
  );
}
