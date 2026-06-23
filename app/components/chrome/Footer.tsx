import { Link } from "react-router";
import { useSnippet } from "~/lib/content";
import { Rss, Mail, Lock } from "lucide-react";
import { LogoMark } from "../brand/LogoMark";

export function Footer() {
  const navSubscribe = useSnippet("snippet:nav.subscribe", "Subscribe");
  const navArchive = useSnippet("snippet:nav.archive", "Archive");
  const navAbout = useSnippet("snippet:nav.about", "About");
  const navContact = useSnippet("snippet:nav.contact", "Contact");
  const navPrivacy = useSnippet("snippet:nav.privacy", "Privacy");
  const navTerms = useSnippet("snippet:nav.terms", "Terms");
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-10 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 font-display text-base font-semibold text-ink">
            <LogoMark className="h-6 w-auto" />
            <span>
              germ<span className="text-brand">omics</span>
            </span>
          </div>
          <p className="mt-1 font-mono text-xs text-muted">
            a microbiology &amp; history podcast and writing project.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-4 font-display text-sm text-muted">
          <Link to="/subscribe" className="hover:text-ink">{navSubscribe}</Link>
          <Link to="/archive" className="hover:text-ink">{navArchive}</Link>
          <a href="/feed/podcast/" className="flex items-center gap-1 hover:text-ink">
            <Rss size={14} aria-hidden /> Podcast feed
          </a>
          <a href="/feed/site.xml" className="flex items-center gap-1 hover:text-ink">
            <Mail size={14} aria-hidden /> Writing feed
          </a>
          {/* Subtle, muted admin entry — admin stays gated, so exposing the link is safe. */}
          <Link
            to="/admin"
            aria-label="Admin"
            className="flex items-center gap-1 text-muted/70 hover:text-ink"
          >
            <Lock size={13} aria-hidden /> Admin
          </Link>
        </nav>
      </div>
      <div className="border-t border-border">
        <nav
          aria-label="Legal"
          className="mx-auto flex max-w-5xl flex-wrap gap-4 px-4 py-3 font-mono text-xs text-muted"
        >
          <Link to="/about" className="hover:text-ink">{navAbout}</Link>
          <Link to="/contact" className="hover:text-ink">{navContact}</Link>
          <Link to="/privacy" className="hover:text-ink">{navPrivacy}</Link>
          <Link to="/terms" className="hover:text-ink">{navTerms}</Link>
        </nav>
      </div>
    </footer>
  );
}
