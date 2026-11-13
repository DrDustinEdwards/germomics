import { BREADCRUMB_MIN_ITEMS } from "@drdustinedwards/site-helpers/head";
import { Breadcrumb } from "capsomer/react/breadcrumb";
import { Link } from "capsomer/react/link";
import type { Crumb } from "~/lib/trails";

// The trail a page inside a section shows (Episodes > Season 1 > an episode): Capsomer's breadcrumb, the levels of the
// page's BreadcrumbList (lib/trails.ts) below the home page, which the header's wordmark already links. A trail too short
// for markup shows nothing (minItems: Prelum's minimum less the home page), so a top-level page carries neither.
export function SectionTrail({ trail }: { trail: Crumb[] }) {
  return (
    <Breadcrumb
      minItems={BREADCRUMB_MIN_ITEMS - 1}
      items={trail
        .slice(1)
        .map((c, i, rest) => ({ label: c.name, href: i < rest.length - 1 ? c.path : undefined }))}
      renderLink={({ href, className: linkClass, children }) => (
        <Link to={href} className={linkClass}>
          {children}
        </Link>
      )}
    />
  );
}
