import { useState } from "react";
import { useRouteLoaderData } from "react-router";
import { Link } from "capsomer/react/link";
import {
  Icon,
  iconLock,
  iconRss,
  markFacebook,
  markInstagram,
  markLinkedin,
  markX,
} from "capsomer/react/icons";
import { Wordmark } from "../brand/Wordmark";
import { ExternalCue } from "../ExternalCue";
import { useSnippet } from "~/lib/content";
import { PRIMARY_KEYS, SUBSCRIBE_DESTINATIONS } from "~/lib/subscribe";

// Fat footer: a persistent nav + trust + SEO surface. Brand block (logo + tagline + real socials),
// three labeled nav columns (Listen / Explore / About), and a bottom bar. Stacks to one column on
// mobile. Tagline + nav labels come from content snippets; socials + podcast directories come from
// the root loader (settings social.* + show_config.subscribe_links), so footer and schema agree.
// Reuses Dustin's brand Wordmark. This consumes snippet:footer.tagline.

// The social marks the footer draws, by the platform socialLinks (lib/seo.ts) names.
const SOCIAL_MARKS: Record<string, { d: string; fill: boolean }> = {
  facebook: markFacebook,
  instagram: markInstagram,
  linkedin: markLinkedin,
  x: markX,
};

/** One of the footer's labeled link columns (Explore, About). */
function FooterNav({ id, title, links }: { id: string; title: string; links: [string, string][] }) {
  return (
    <nav aria-labelledby={id}>
      <h2 id={id} className="gm-footer-title">
        {title}
      </h2>
      <ul className="gm-footer-list">
        {links.map(([to, label]) => (
          <li key={to}>
            <Link to={to} className="gm-footer-link gm-footer-tap">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

type RootData = {
  socials?: { platform: string; label: string; url: string }[];
  subscribeLinks?: Record<string, string>;
};

export function Footer() {
  const root = useRouteLoaderData("root") as RootData | undefined;
  const socials = root?.socials ?? [];
  const subscribeLinks = root?.subscribeLinks ?? {};
  const tagline = useSnippet(
    "snippet:footer.tagline",
    "a microbiology and history podcast and writing project.",
  );

  const explore: [string, string][] = [
    ["/episodes", useSnippet("snippet:nav.episodes", "Episodes")],
    ["/writing", useSnippet("snippet:nav.writing", "Writing")],
    ["/archive", useSnippet("snippet:nav.archive", "Archive")],
    ["/data", useSnippet("snippet:nav.data", "Data")],
    ["/games", useSnippet("snippet:nav.games", "Games")],
    ["/search", useSnippet("snippet:nav.search", "Search")],
  ];
  const about: [string, string][] = [
    ["/about", useSnippet("snippet:nav.about", "About")],
    ["/contact", useSnippet("snippet:nav.contact", "Contact")],
    ["/privacy", useSnippet("snippet:nav.privacy", "Privacy")],
    ["/terms", useSnippet("snippet:nav.terms", "Terms")],
    ["/accessibility", "Accessibility"],
  ];
  const [year] = useState(() => new Date().getFullYear());

  return (
    <footer className="gm-footer">
      {/* Base is 3 columns so Listen/Explore/About sit side by side on phones; sm/lg layout is unchanged.
          The brand block spans all 3 at base to stay full width above them. */}
      <div className="gm-footer-grid">
        {/* Brand block. gm-footer-brand flows it below the three nav columns on phones only; DOM order
            is unchanged, so at sm it is still the full-width top row and at lg still the first/left column. */}
        <div className="gm-footer-brand">
          {/* Rectangular germomics lockup as a modest mark (~80px tall) above the tagline. */}
          <Link to="/" aria-label="Germomics home" className="gm-footer-home">
            <Wordmark className="gm-footer-wordmark" />
          </Link>
          <p className="gm-footer-tagline">{tagline}</p>
          {socials.length ? (
            <ul className="gm-footer-socials">
              {socials.map((s) => (
                <li key={s.platform}>
                  <a href={s.url} rel="me" aria-label={s.label} className="gm-footer-social">
                    {SOCIAL_MARKS[s.platform] ? (
                      <Icon {...SOCIAL_MARKS[s.platform]} className="gm-footer-social-icon" />
                    ) : null}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* Listen */}
        <nav aria-labelledby="footer-listen">
          <h2 id="footer-listen" className="gm-footer-title">
            Listen
          </h2>
          <ul className="gm-footer-list">
            {PRIMARY_KEYS.map((k) =>
              subscribeLinks[k] ? (
                <li key={k}>
                  <a
                    href={subscribeLinks[k]}
                    className={"gm-footer-link-icon gm-footer-link gm-footer-tap"}
                  >
                    {SUBSCRIBE_DESTINATIONS[k].label}
                    <ExternalCue />
                  </a>
                </li>
              ) : null,
            )}
            <li>
              <a
                href="/feed/podcast/"
                className={"gm-footer-link-icon gm-footer-link gm-footer-tap"}
              >
                <Icon d={iconRss} /> Podcast RSS
              </a>
            </li>
            <li>
              <Link to="/subscribe" className={"gm-footer-link gm-footer-tap"}>
                More ways to listen →
              </Link>
            </li>
          </ul>
        </nav>

        <FooterNav id="footer-explore" title="Explore" links={explore} />
        <FooterNav id="footer-about" title="About" links={about} />
      </div>

      {/* Bottom bar */}
      <div className="gm-footer-base">
        <div className="gm-footer-base-row">
          <span>
            © {year} Germomics and{" "}
            <a href="https://dustinedwards.info" rel="me" className="gm-footer-link">
              Dr. Dustin Edwards
            </a>
          </span>
          <span aria-hidden>·</span>
          <a href="/feed/site.xml" className="gm-footer-link">
            Writing feed
          </a>
          <Link to="/admin" rel="nofollow" prefetch="none" className="gm-footer-top">
            <Icon d={iconLock} /> Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}
