import { useRouteLoaderData } from "react-router";
import { Rss, Lock } from "lucide-react";
import { AppLink } from "../AppLink";
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

function SocialIcon({ platform }: { platform: string }) {
  const common = { viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true, className: "h-4 w-4" } as const;
  if (platform === "facebook")
    return (
      <svg {...common}>
        <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6 4.39 10.97 10.13 11.85v-8.38H7.08v-3.47h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.69.24 2.69.24v2.96h-1.52c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.47h-2.8v8.38C19.61 23.04 24 18.07 24 12.07z" />
      </svg>
    );
  if (platform === "x")
    return (
      <svg {...common}>
        <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93zM17.61 20.64h2.04L6.49 3.24H4.3z" />
      </svg>
    );
  if (platform === "instagram")
    return (
      <svg {...common}>
        <path d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16zm0-2.16C8.74 0 8.33.01 7.05.07 2.7.27.27 2.69.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.36 2.62 6.78 6.98 6.98C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c4.35-.2 6.78-2.62 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.36-2.62-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84a6.16 6.16 0 100 12.32 6.16 6.16 0 000-12.32zM12 16a4 4 0 110-8 4 4 0 010 8zm6.41-11.85a1.44 1.44 0 100 2.88 1.44 1.44 0 000-2.88z" />
      </svg>
    );
  return null;
}

export function Footer() {
  const root = useRouteLoaderData("root") as RootData | undefined;
  const socials = root?.socials ?? [];
  const subscribeLinks = root?.subscribeLinks ?? {};
  const tagline = useSnippet("snippet:footer.tagline", "a microbiology and history podcast and writing project.");

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
  ];
  const year = new Date().getFullYear();
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
          <AppLink to="/" aria-label="Germomics home" className="inline-flex">
            <Wordmark className="h-20 w-auto" />
          </AppLink>
          <p className="mt-3 max-w-xs font-mono text-xs leading-relaxed text-muted">{tagline}</p>
          {socials.length ? (
            <ul className="mt-4 flex items-center gap-3">
              {socials.map((s) => (
                <li key={s.platform}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="me noopener"
                    aria-label={`${s.label} (opens in a new tab)`}
                    className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted hover:border-accent hover:text-accent"
                  >
                    <SocialIcon platform={s.platform} />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* Listen */}
        <nav aria-labelledby="footer-listen">
          <h3 id="footer-listen" className="font-display text-sm font-semibold text-ink">Listen</h3>
          <ul className="mt-3 space-y-2 max-sm:space-y-0 text-sm">
            {PRIMARY_KEYS.map((k) =>
              subscribeLinks[k] ? (
                <li key={k}>
                  <a
                    href={subscribeLinks[k]}
                    target="_blank"
                    rel="noopener"
                    className={`inline-flex items-center gap-1 ${link} ${tap}`}
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
                target="_blank"
                rel="noopener"
                className={`inline-flex items-center gap-1 ${link} ${tap}`}
              >
                <Rss size={14} aria-hidden /> Podcast RSS
                <ExternalCue />
              </a>
            </li>
            <li><AppLink to="/subscribe" className={`${link} ${tap}`}>More ways to listen →</AppLink></li>
          </ul>
        </nav>

        {/* Explore */}
        <nav aria-labelledby="footer-explore">
          <h3 id="footer-explore" className="font-display text-sm font-semibold text-ink">Explore</h3>
          <ul className="mt-3 space-y-2 max-sm:space-y-0 text-sm">
            {explore.map(([to, label]) => (
              <li key={to}><AppLink to={to} className={`${link} ${tap}`}>{label}</AppLink></li>
            ))}
          </ul>
        </nav>

        {/* About */}
        <nav aria-labelledby="footer-about">
          <h3 id="footer-about" className="font-display text-sm font-semibold text-ink">About</h3>
          <ul className="mt-3 space-y-2 max-sm:space-y-0 text-sm">
            {about.map(([to, label]) => (
              <li key={to}><AppLink to={to} className={`${link} ${tap}`}>{label}</AppLink></li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-4 font-mono text-xs text-muted">
          <span>
            © {year} Germomics and{" "}
            <a href="https://dustinedwards.info" target="_blank" rel="me noopener" className={link}>
              Dr. Dustin Edwards
            </a>
          </span>
          <span aria-hidden>·</span>
          <a href="/feed/site.xml" className={link}>Writing feed</a>
          <AppLink to="/admin" rel="nofollow" prefetch="none" className="ml-auto inline-flex items-center gap-1 text-muted/70 hover:text-ink">
            <Lock size={14} aria-hidden /> Admin
          </AppLink>
        </div>
      </div>
    </footer>
  );
}
