// /txasm - landing for the Texas Branch of the American Society for Microbiology, which germomics
// hosted for years. Prose comes from the page:txasm content block (D1, editable); a prominent CTA
// bridges to the branch's own site at txasm.org. ?preview shows the draft to a signed-in admin.
import { htmlToText } from "@drdustinedwards/site-helpers/text";
import { ExternalLink } from "lucide-react";
import type { Route } from "./+types/txasm";
import { getEnv } from "@dustinedwards/site-runtime/context";
import { loadPage, isPreviewing } from "~/lib/content.server";
import { pageHead } from "~/lib/seo";
import { BodyRenderer } from "~/components/content/BodyRenderer";

const TITLE = "Texas Branch of the American Society for Microbiology";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [{ title: TITLE }];
  const { title, description } = loaderData;
  return pageHead({ path: "/txasm", title, description });
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const preview = await isPreviewing(env, request);
  const page = await loadPage(env, "page:txasm", { includeDrafts: preview });
  return {
    title: page.title || TITLE,
    description: htmlToText(page.html),
    html: page.html,
  };
}

export default function Txasm({ loaderData }: Route.ComponentProps) {
  const { title, html } = loaderData;
  return (
    <div className="gm-narrow">
      <p className="gm-eyebrow">Texas Branch ASM</p>
      <h1 className="gm-txasm-title">{title}</h1>
      <div data-context="prose" className="gm-txasm-body">
        <BodyRenderer html={html} page />
      </div>

      <a href="https://txasm.org" className="gm-txasm-button">
        Visit txasm.org
        <ExternalLink size={16} aria-hidden />
        <span className="cap-sr-only"> (another site)</span>
      </a>
    </div>
  );
}
