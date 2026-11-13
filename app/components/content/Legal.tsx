// The legal pages (privacy + terms): a clearly-marked "draft, not legal advice" banner and the
// last-updated date around the page body. Keeping these here means both pages stay consistent and the
// review status is impossible to miss.
import { Icon, iconInfo } from "capsomer/react/icons";
import { BodyRenderer } from "~/components/content/BodyRenderer";

// Bump this whenever the legal copy changes.
const LEGAL_LAST_UPDATED = "June 22, 2026";

function LegalDate() {
  return <p className="gm-legal-updated">Last updated: {LEGAL_LAST_UPDATED}</p>;
}

function ReviewBanner() {
  return (
    <aside role="note" className="gm-legal-draft">
      <p className="gm-legal-draft-title">
        <Icon d={iconInfo} /> Draft, pending review
      </p>
      <p className="gm-legal-draft-text">
        This is a plain-language draft for completeness, not legal advice. It should be reviewed by
        the site owner (and, where appropriate, a professional) before the public launch.
      </p>
    </aside>
  );
}

export function LegalPage({ title, html }: { title: string; html: string }) {
  return (
    <article data-context="prose" className="gm-legal">
      <h1 className="gm-legal-title">{title}</h1>
      <LegalDate />
      <ReviewBanner />
      <BodyRenderer html={html} page />
    </article>
  );
}
