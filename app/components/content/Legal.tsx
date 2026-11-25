// The legal pages (privacy + terms): a clearly-marked "draft, not legal advice" banner and the
// last-saved date around the page body. Keeping these here means both pages stay consistent and the
// review status is impossible to miss.
import { Icon, iconInfo } from "capsomer/react/icons";
import { BodyRenderer } from "~/components/content/BodyRenderer";

/** The page's own last save, as "June 22, 2026" (the stored time is UTC). */
function LegalDate({ updatedAt }: { updatedAt: string }) {
  const day = new Date(`${updatedAt.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  });
  return <p className="gm-legal-updated">Last updated: {day}</p>;
}

function ReviewBanner() {
  return (
    <aside role="note" className="gm-legal-draft">
      <p className="gm-legal-draft-title">
        <Icon d={iconInfo} /> Draft, pending review
      </p>
      <p className="gm-legal-draft-text">
        This is a plain-language draft, not legal advice. A lawyer has not reviewed it.
      </p>
    </aside>
  );
}

export function LegalPage({
  title,
  html,
  updatedAt,
}: {
  title: string;
  html: string;
  updatedAt?: string;
}) {
  return (
    <article data-context="prose" className="gm-legal">
      <h1 className="gm-legal-title">{title}</h1>
      {updatedAt ? <LegalDate updatedAt={updatedAt} /> : null}
      <ReviewBanner />
      <BodyRenderer html={html} page />
    </article>
  );
}
