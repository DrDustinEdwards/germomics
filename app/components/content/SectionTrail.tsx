import { BREADCRUMB_MIN_ITEMS } from "@drdustinedwards/site-helpers/head";
import { Breadcrumb } from "capsomer/react/breadcrumb";
import { Link } from "capsomer/react/link";
import type { Crumb } from "~/lib/trails";

// The trail a page inside a section shows (Episodes > Season 1 > an episode): Capsomer's breadcrumb, the levels of the
// page's BreadcrumbList (lib/trails.ts) below the home page, which the header's wordmark already links. A trail too short
// for markup shows nothing, so a top-level page carries neither. Its look is app.css's `.cap-breadcrumb` block.
export function SectionTrail({ trail, className = "mb-4" }: { trail: Crumb[]; className?: string }) {
  if (trail.length < BREADCRUMB_MIN_ITEMS) return null;
  return (
    <div className={className}>
      <Breadcrumb
        items={trail.slice(1).map((c, i, rest) => ({ label: c.name, href: i < rest.length - 1 ? c.path : undefined }))}
        renderLink={({ href, className: linkClass, children }) => (
          <Link to={href} className={linkClass}>
            {children}
          </Link>
        )}
      />
    </div>
  );
}
