import { Link } from "capsomer/react/link";

/** A content page's key to its public URL: site-search page hits and the admin Preview link. */
export const PAGE_HREF: Record<string, string> = {
  "page:about": "/about",
  "page:dustin-edwards": "/about/dustin-edwards",
  "page:privacy": "/privacy",
  "page:terms": "/terms",
  "page:contact": "/contact",
  "page:txasm": "/txasm",
  "page:llms": "/llms.txt",
  "page:ai-txt": "/ai.txt",
};

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
    <Tag className={`${className} gm-page-hits`}>
      <p className="gm-page-hits-label">Pages</p>
      <ul className="gm-page-hits-list">
        {pages.map((p) => (
          <li key={p.key}>
            <Link to={PAGE_HREF[p.key] ?? "/"} className="gm-page-hits-link">
              {p.title}
            </Link>
          </li>
        ))}
      </ul>
    </Tag>
  );
}
