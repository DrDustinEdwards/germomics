import { useState } from "react";
import { useRouteLoaderData } from "react-router";
import { Rss, Lock } from "lucide-react";
import { Link } from "capsomer/react/link";
import { Icon, SOCIAL, type SocialName } from "capsomer/react/icons";
import { Wordmark } from "../brand/Wordmark";
import { ExternalCue } from "../ExternalCue";
import { useSnippet } from "~/lib/content";
import { PRIMARY_KEYS, SUBSCRIBE_DESTINATIONS } from "~/lib/subscribe";

// Fat footer: a persistent nav + trust + SEO surface. Brand block (logo + tagline + real socials),
// three labeled nav columns (Listen / Explore / About), and a bottom bar. Stacks to one column on
// mobile. Tagline + nav labels come from content snippets; socials + podcast directories come from
// the root loader (settings social.* + show_config.subscribe_links), so footer and schema agree.
// Reuses Dustin's brand Wordmark. This consumes snippet:footer.tagline.

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

  const explore: [string, string, string][] = [
    ["/episodes", useSnippet("snippet:nav.episodes", "Episodes"), "episodes"],
    ["/writing", useSnippet("snippet:nav.writing", "Writing"), "writing"],
    ["/archive", useSnippet("snippet:nav.archive", "Archive"), "archive"],
    ["/data", useSnippet("snippet:nav.data", "Data"), "data"],
    ["/games", useSnippet("snippet:nav.games", "Games"), "games"],
    ["/search", useSnippet("snippet:nav.search", "Search"), "search"],
  ];
  const about: [string, string][] = [
    ["/about", useSnippet("snippet:nav.about", "About")],
    ["/contact", useSnippet("snippet:nav.contact", "Contact")],
    ["/privacy", useSnippet("snippet:nav.privacy", "Privacy")],
    ["/terms", useSnippet("snippet:nav.terms", "Terms")],
    ["/accessibility", "Accessibility"],
  ];
  const [year] = useState(() => new Date().getFullYear());
  const link = "text-muted hover:text-ink";
  // Below sm the three lists go 3-up; give each link a 44px tappable row there. Inert at sm+.
  const tap = "max-sm:flex max-sm:min-h-11 max-sm:items-center";

  return (
    <footer className="border-t border-border bg-surface">
      {/* Base is 3 columns so Listen/Explore/About sit side by side on phones; sm/lg layout is unchanged.
          The brand block spans all 3 at base to stay full width above them. */}
      <div className="mx-auto grid max-w-5xl grid-cols-3 gap-x-3 gap-y-8 px-4 py-12 sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-4">
        {/* Brand block. max-sm:order-last flows it below the three nav columns on phones only; DOM order
            is unchanged, so at sm it is still the full-width top row and at lg still the first/left column. */}
        <div className="col-span-3 max-sm:order-last sm:col-span-2 lg:col-span-1">
          {/* Rectangular germomics lockup as a modest mark (~80px tall) above the tagline. */}
          <Link to="/" aria-label="Germomics home" className="inline-flex">
            <Wordmark className="h-20 w-auto" />
          </Link>
          <p className="mt-3 max-w-xs font-mono text-xs leading-relaxed text-muted">{tagline}</p>
          {socials.length ? (
            <ul className="mt-4 flex items-center gap-3">
              {socials.map((s) => (
                <li key={s.platform}>
                  <a
                    href={s.url}
                    rel="me"
                    aria-label={s.label}
                    className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted hover:border-accent hover:text-accent"
                  >
                    {s.platform in SOCIAL ? (
                      <Icon name={s.platform as SocialName} className="[--icon-size:1rem]" />
                    ) : null}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* Listen */}
        <nav aria-labelledby="footer-listen">
          <h2 id="footer-listen" className="font-display text-sm font-semibold text-ink">
            Listen
          </h2>
          <ul className="mt-3 space-y-2 max-sm:space-y-0 text-sm">
            {PRIMARY_KEYS.map((k) =>
              subscribeLinks[k] ? (
                <li key={k}>
                  <a
                    href={subscribeLinks[k]}
                    className={`inline-flex items-center gap-1 ${link} ${tap}`}
                  >
                    {SUBSCRIBE_DESTINATIONS[k].label}
                    <ExternalCue />
                  </a>
                </li>
              ) : null,
            )}
            <li>
              <a href="/feed/podcast/" className={`inline-flex items-center gap-1 ${link} ${tap}`}>
                <Rss size={14} aria-hidden /> Podcast RSS
              </a>
            </li>
            <li>
              <Link to="/subscribe" className={`${link} ${tap}`}>
                More ways to listen →
              </Link>
            </li>
          </ul>
        </nav>

        {/* Explore */}
        <nav aria-labelledby="footer-explore">
          <h2 id="footer-explore" className="font-display text-sm font-semibold text-ink">
            Explore
          </h2>
          <ul className="mt-3 space-y-2 max-sm:space-y-0 text-sm">
            {explore.map(([to, label]) => (
              <li key={to}>
                <Link to={to} className={`${link} ${tap}`}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* About */}
        <nav aria-labelledby="footer-about">
          <h2 id="footer-about" className="font-display text-sm font-semibold text-ink">
            About
          </h2>
          <ul className="mt-3 space-y-2 max-sm:space-y-0 text-sm">
            {about.map(([to, label]) => (
              <li key={to}>
                <Link to={to} className={`${link} ${tap}`}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-4 font-mono text-xs text-muted">
          <span>
            © {year} Germomics and{" "}
            <a href="https://dustinedwards.info" rel="me" className={link}>
              Dr. Dustin Edwards
            </a>
          </span>
          <span aria-hidden>·</span>
          <a href="/feed/site.xml" className={link}>
            Writing feed
          </a>
          <Link
            to="/admin"
            rel="nofollow"
            prefetch="none"
            className="ml-auto inline-flex items-center gap-1 text-muted hover:text-ink"
          >
            <Lock size={14} aria-hidden /> Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}
