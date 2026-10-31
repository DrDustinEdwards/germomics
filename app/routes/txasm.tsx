// /txasm - landing for the Texas Branch of the American Society for Microbiology, which germomics
// hosted for years. Prose comes from the page:txasm content block (D1, editable); a prominent CTA
// bridges to the branch's own site at txasm.org. ?preview shows the draft to a signed-in admin.
import { ExternalLink } from "lucide-react";
import type { Route } from "./+types/txasm";
import { getEnv } from "~/lib/context.server";
import { loadPage, isPreviewing } from "~/lib/content.server";
import { pageHead, stripHtml } from "~/lib/seo";
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
    description: stripHtml(page.value),
    html: page.value,
  };
}

export default function Txasm({ loaderData }: Route.ComponentProps) {
  const { title, html } = loaderData;
  return (
    <div className="mx-auto max-w-2xl">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Texas Branch ASM</p>
      <h1 className="mt-3 font-display text-4xl font-semibold leading-tight">{title}</h1>
      <div className="prose-legal mt-4">
        <BodyRenderer html={html} />
      </div>

      <a
        href="https://txasm.org"
        target="_blank"
        rel="noopener"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 font-display text-sm font-medium text-white hover:bg-brand-strong"
      >
        Visit txasm.org
        <ExternalLink size={16} aria-hidden />
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </div>
  );
}
