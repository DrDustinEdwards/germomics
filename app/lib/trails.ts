// The breadcrumb trail of each page inside a section, home first. One list feeds both the page's BreadcrumbList (pageHead's
// `breadcrumbs`) and its visible trail (SectionTrail), so what a visitor sees is what the markup describes. A top-level
// page has no trail: Prelum writes a BreadcrumbList only for three levels or more (BREADCRUMB_MIN_ITEMS).
import type { Post } from "~/db/schema";

export type Crumb = { name: string; path: string };

const HOME: Crumb = { name: "Germomics", path: "/" };

/** A page one level inside a section: Germomics > the section > the page. */
export function sectionPageTrail(section: Crumb, page: Crumb): Crumb[] {
  return [HOME, section, page];
}

export function seasonTrail(num: number): Crumb[] {
  return sectionPageTrail({ name: "Episodes", path: "/episodes" }, { name: `Season ${num}`, path: `/season/${num}` });
}

/** An episode runs through its season, when it has one; an article through Writing. */
export function postTrail(post: Pick<Post, "kind" | "seasonNumber" | "title" | "slug">): Crumb[] {
  const page = { name: post.title, path: `/${post.slug}` };
  if (post.kind !== "episode") return sectionPageTrail({ name: "Writing", path: "/writing" }, page);
  if (!post.seasonNumber) return sectionPageTrail({ name: "Episodes", path: "/episodes" }, page);
  return [...seasonTrail(post.seasonNumber), page];
}
