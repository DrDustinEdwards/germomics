// Shared chrome for the legal pages (privacy + terms): a clearly-marked "draft, not legal advice"
// banner and the last-updated date. Keeping these here means both pages stay consistent and the
// review status is impossible to miss.
import { Info } from "lucide-react";

// Bump this whenever the legal copy changes.
const LEGAL_LAST_UPDATED = "June 22, 2026";

export function LegalDate() {
  return (
    <p className="mt-2 font-mono text-xs text-muted">Last updated: {LEGAL_LAST_UPDATED}</p>
  );
}

export function ReviewBanner() {
  return (
    <aside
      role="note"
      className="my-6 rounded-xl border border-dashed border-amber-500/50 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200"
    >
      <p className="flex items-center gap-2 font-display font-semibold">
        <Info size={15} aria-hidden /> Draft, pending review
      </p>
      <p className="mt-1 text-muted">
        This is a plain-language draft for completeness, not legal advice. It should be reviewed by
        the site owner (and, where appropriate, a professional) before the public launch.
      </p>
    </aside>
  );
}
