// /about - what germomics is, who makes it, how to follow it. Prose comes from the page:about and
// page:dustin-edwards content blocks (D1, editable); Organization JSON-LD carries entity clarity.
// Public, WCAG AA. ?preview shows drafts to a signed-in admin.
import { htmlToText } from "@drdustinedwards/site-helpers/text";
import { Link } from "capsomer/react/link";
import { Rss, Mic, FileText, Database, Gamepad2, User } from "lucide-react";
import type { Route } from "./+types/about";
import { getEnv } from "@dustinedwards/site-runtime/context";
import { getSettings } from "~/lib/context.server";
import { getShowConfig } from "~/lib/show.server";
import { loadPage, isPreviewing, settingAddress } from "~/lib/content.server";
import { jsonLd } from "@drdustinedwards/site-helpers/schema";
import { buildOrganizationLd, pageHead } from "~/lib/seo";
import { BodyRenderer } from "~/components/content/BodyRenderer";
import { AUTHOR } from "~/lib/about";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: "About Germomics" }];
  const { show, address, title, description } = loaderData;
  return [
    ...pageHead({ path: "/about", title, description }),
    jsonLd(buildOrganizationLd(show, { address })),
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const preview = await isPreviewing(env, request);
  const [about, bio, show, settings] = await Promise.all([
    loadPage(env, "page:about", { includeDrafts: preview }),
    loadPage(env, "page:dustin-edwards", { includeDrafts: preview }),
    getShowConfig(env),
    getSettings(context),
  ]);
  return {
    show,
    address: settingAddress(settings),
    title: about.title || "About Germomics",
    description: htmlToText(about.html),
    aboutHtml: about.html,
    bioHtml: bio.html,
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
    <div className="gm-narrow">
      <p className="gm-eyebrow">About</p>
      <h1 className="gm-eyebrow-title">{title}</h1>
      <div data-context="prose" className="gm-page-body">
        <BodyRenderer html={aboutHtml} />
      </div>

      <section className="gm-about-host">
        <h2 className="gm-about-host-title">
          <User size={18} aria-hidden /> The author
        </h2>
        <div data-context="prose" className="gm-about-host-text">
          <BodyRenderer html={bioHtml} />
        </div>
        <Link to={`/about/${AUTHOR.slug}`} className="gm-about-host-link">
          More about {AUTHOR.name} →
        </Link>
      </section>

      <section className="gm-about-section">
        <h2 className="gm-post-section-title">Explore</h2>
        <ul className="gm-about-grid">
          {EXPLORE.map(({ to, icon: Icon, label, note }) => (
            <li key={to}>
              <Link to={to} className="gm-about-card">
                <span className="gm-about-card-title">
                  <Icon size={16} aria-hidden /> {label}
                </span>
                <span className="gm-index-card-text">{note}</span>
              </Link>
            </li>
          ))}
        </ul>
        <a href="/feed/podcast/" className="gm-about-more">
          <Rss size={15} aria-hidden /> Podcast RSS
        </a>
      </section>
    </div>
  );
}
