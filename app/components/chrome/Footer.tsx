import { Link } from "react-router";
import { Rss, Mail, Lock } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-10 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-display text-base font-semibold text-ink">
            germ<span className="text-brand">omics</span>
          </div>
          <p className="mt-1 font-mono text-xs text-muted">
            microbiology &amp; history, a podcast and writing project.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-4 font-display text-sm text-muted">
          <Link to="/subscribe" className="hover:text-ink">Subscribe</Link>
          <Link to="/archive" className="hover:text-ink">Archive</Link>
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
    </footer>
  );
}
