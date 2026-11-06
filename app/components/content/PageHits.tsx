import { Link } from "capsomer/react/link";
import { PAGE_HREF } from "~/lib/page-href";

// The content pages a site search matched (about, privacy, terms...), as one row of links.
// `as` and `className` keep each listing's own wrapper.
export function PageHits({
  pages,
  as: Tag = "div",
  className,
}: {
  pages: { key: string; title: string }[];
  as?: "div" | "section";
  className: string;
}) {
  if (!pages.length) return null;
  return (
    <Tag className={`${className} rounded-xl border border-border bg-surface p-4`}>
      <p className="mb-2 font-mono text-[11px] uppercase tracking-wide text-muted">Pages</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {pages.map((p) => (
          <li key={p.key}>
            <Link to={PAGE_HREF[p.key] ?? "/"} className="text-accent hover:underline">
              {p.title}
            </Link>
          </li>
        ))}
      </ul>
    </Tag>
  );
}
