// /accessibility - the accessibility statement every site in the network carries, from Prelum's
// accessibilityStatement so the wording and the standard stay the same everywhere. germomics is not on
// Capsomer, and its links in running text are underlined (measured on germomics.com/about, 2026-11-01).
import { accessibilityStatement, ACCESSIBILITY_PATH } from "@drdustinedwards/site-helpers/accessibility";
import { pageHead } from "~/lib/seo";
import { BodyRenderer } from "~/components/content/BodyRenderer";

const statement = accessibilityStatement({
  siteName: "Germomics",
  contact: { href: "/contact", label: "the contact page" },
  date: "2026-11-01",
  capsomer: false,
  links: "underline",
});

export function meta() {
  return pageHead({ path: ACCESSIBILITY_PATH, title: statement.title, description: statement.description });
}

export default function Accessibility() {
  return (
    <article className="prose-legal mx-auto max-w-2xl">
      <h1 className="font-display text-4xl font-semibold leading-tight">{statement.title}</h1>
      <BodyRenderer html={statement.html} page />
    </article>
  );
}
